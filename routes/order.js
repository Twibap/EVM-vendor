const express = require('express');
const router = express.Router();

/* ====== Confidential data ====== */
const Confidential = require("../confidential.js");

/* ====== Log Color Setting ================== */
const colors = require('../app_modules/log/colors');

/* ====== Web3.js Setting ==================== */
const fs = require("fs");
const Web3 = require("web3");
console.log(Web3.version);

// WebsocketProvider를 사용하는 경우 Promise를 사용할 수 없다.
// onmessage()에서 모두 처리해야함.
let web3Provider = "https://ropsten.infura.io/v3/"+Confidential.INFURA_PROJECT_ID;
let web3 = new Web3( Web3.givenProvider || web3Provider );

let source = fs.readFileSync("Vendor.json");
let abi = JSON.parse( source ).abi;

let contract = new web3.eth.Contract(abi, '0x3B2fbeAEA307cFDA5906650d26c6de1fF50E8ebE');
contract.options.from = web3.eth.accounts[0];

// Address Object 
let contract_manager = web3.eth.accounts.privateKeyToAccount( Confidential.PRIVATE_KEY );

//console.log( contract );
console.log( contract_manager );

/* ====== DB Setting ========================= */
const transaction = require('../app_modules/schema/transaction.js');
const price = require('../app_modules/schema/price.js');

var mongoose = require("mongoose");
var db = mongoose.connection;
var dbUrl = 'mongodb://localhost/';
var dbName = 'EVM';

mongoose.Promise = global.Promise;
db.on('error', console.error);
db.once('open', ()=>{
	console.log( colors.info("Database is connected") );
});
mongoose.connect( dbUrl+dbName, {useNewUrlParser: true} );

/* ====== Bootpay Setting ===================== */
const BootpayRest = require('../node_modules/restler/lib/bootpay.js');
BootpayRest.setConfig(
	Confidential.Bootpay_REST_Application_ID,
	Confidential.Bootpay_Private_Key
);

/* ====== Address Utils Setting ===================== */
const addressUtils = require('../app_modules/function/addressUtils.js');

/* ====== Firebase Setting ========================== */
const firebase = require('firebase-admin');
const serviceAccount = require('../evm-the-vending-machine-firebase-adminsdk-0vy7i-369c0eb7e2.json');

firebase.initializeApp({
  credential: firebase.credential.cert(serviceAccount),
  databaseURL: "https://evm-the-vending-machine.firebaseio.com"
});

/* ====== Route ===================================== */
router.post('/askN', (request, response)=>{

	// 주소 유효성 확인
	addressUtils.isValidAddress( request.body.address ).then(()=>{
		return web3.eth.getBalance( contract.options.address );
	})
	// TODO 잔고 확인
	// 1차. Contract 잔고에 따라 주문 처리
	// TODO 2차. Contract 잔고와 채굴되지 않은 Tx까지 합산해서 주문 처리 
		.then(( contractBalance )=>{
			console.log("Balance - "+web3.utils.fromWei(contractBalance));
			if (contractBalance === 0){
				handleOrderError("Lumberroom is empty");
				return;
			}

			// Ether 판매량 계산
			return price.getGoodsAmount( 
				request.body.price_id, 
				request.body.amount, 
				contractBalance );
		})
	// 주문내용 저장
		.then((goodsAmount)=>{	// goodsAmount is BN
			var order = transaction.mkOrder(request.body, goodsAmount);
			return order.save();
		})
	// 주문번호 반환
		.then((savedOrder)=>{
			console.log( colors.info( savedOrder ) );
			response.status(202);	// Accepted 
			response.end( JSON.stringify( savedOrder ) );
		})
		.catch((error)=>{
			handleOrderError( error, request, response ) ;
		});
});

// 결제정보 검증단계
// Client가 전송한 결제 정보가 정상이면 Ether를 송금한다.
router.post('/payment', (request, response)=>{
	var bill = transaction.mkBill( request.body );

	// 결제 검증 
	BootpayRest.getAccessToken().then(function (response) {
		// Access Token을 발급 받았을 때
		if (response.status === 200 && response.data.token !== undefined) {

			return BootpayRest.verify( bill.receipt_id );
		}
	}).then(function (_response) {
		// 검증 결과를 제대로 가져왔을 때
		if (_response.status === 200) {
			// 원래 주문했던 금액이 일치하는가?
			// 그리고 결제 상태가 완료 상태인가?
			if (_response.data.price == bill.price && _response.data.status === 1) {
				console.log( colors.info("Payment Ok") );

				// 인증 정보 저장
				bill.unit = _response.data.unit;
				return bill.save();
			}
		}
	}).then((savedBill)=>{
		bill = savedBill;

		// 결제 id를 Order에 저장
		return transaction.Order.updateOne(
			{_id: savedBill.order_id},
			{bill_id: savedBill._id});

	}).then((updateResult)=>{
		if( updateResult.ok )		// { n: 1, nModified: 1, ok: 1 }
			console.log( colors.info( "Payment Saved and Order update" ) );	
		else
			throw Error("Payment data save is Failed");

		return transaction.Order.findById(bill.order_id);
	}).then((updatedOrder)=>{
		console.log( colors.info( updatedOrder ) );	

		// Ether Vending Contract에 전송 Tx 발행
		// 1. 서명된 Tx를 생성한다.
		return getTxSendGoods(updatedOrder.address, updatedOrder.amount_ether);
	}).then((txSendGoods)=>{
		console.log(txSendGoods);
		let signedTx = txSendGoods.rawTransaction;

		// 2. 서명된 Tx를 발행한다.
		return web3.eth.sendSignedTransaction( signedTx )
			.once('transactionHash',(hash)=>{
				// 주문 정보에 Transaction Hash 저장
				transaction.Order.updateOne(
					{_id: bill.order_id},
					{txHash: hash}
				).exec();

				// Transaction이 발행되면 Tx Hash 값을 Client에게 전달한다.
				// TODO Client에서 알람 구현할 것.
				let responseMsg = {
					transactionHash: hash
				};
				console.log('transactionHash - '+ JSON.stringify(responseMsg) );
				response.json(responseMsg);
			})
			.on('error',(error)=>{
				console.log('on Error - '+error);
			});

	}).then((receipt)=>{
		// Transaction이 블록에 포함되면 receipt를 얻는다.
		// 블록 Hash를 Client에게 전달하여 거래를 완료한다.
		// TODO FCM 등 다른 수단으로 Ethereum이 전송되었다는 사실을 알린다.

		transaction.Order.updateOne(
			{_id: bill.order_id},
			{bkHash: receipt.blockHash}
		).exec();

		console.log('Receipt', colors.verbose(receipt) );
		return responseReceipt(receipt);
	}).then((fcmResponse)=>{
		console.log('Successfully send receipt', fcmResponse);
	}).catch((error)=>{
		console.log( error );
		response.status(500);
		response.end( error.toString() );
	});
});

function responseReceipt(receipt){
	return transaction.Order
		.findOne({ txHash: receipt.transactionHash})
		.then((order)=>{
			// 저장된 FCM 토큰 조회하기
			let clientToken = order.token;
			console.log("Response receipt to "+order);

			// 전송할 메시지 조립하기
			let txComplete = {
				bkHash: receipt.blockHash,
				bkNumber: receipt.blockNumber.toString(),
				txHash: receipt.transactionHash,
				txIndex: receipt.transactionIndex.toString()
			};

			let message = {
				data: txComplete,
				android: {
					priority: 'high',	// or 'normal' 
					notification: {
						title: "전송 완료",
						body: "이더리움 전송이 완료되었습니다.",
						tag: txComplete.txHash
					},
					data: txComplete
				},
				token: clientToken
			}
			
			// 전송하기
			// return message id string with Promise
			return firebase.messaging().send(message);
		});

}

function sendGoods(order){
	if( order.bill_id == null){
		var errorMsg = "Payment not confirmed";
		console.log( colors.error( errorMsg ) );
		throw new Error( errorMsg );
	}

	let goods = order.amount_ether;
	let buyer = order.address;

	//let payload = contract.sendGoods.getData( buyer, goods);

	// return receipt with Promise 
	return contract.methods.sendGoods(buyer, goods).send({from: "0xB4760d454eAEA3FEe39EA0a65DE4c108a3960582"})
		.once("transactionHash", (hash)=>{
			console.log( colors.verbose("Hash - "+hash) );
		})
		.once("receipt", (receipt)=>{
			console.log( colors.verbose("Receipt - "+receipt) );
		})
		.on("confirmation", (confNumber, receipt)=>{
			console.log( colors.verbose("Confirmation Number - "+confNumber) );
			console.log( colors.verbose("Confirmation Receipt - "+receipt) );
		})
		.catch(( error )=>{
			console.log( error );
		});
}

/*
 *	estimateGas - 35040
 *	{ messageHash: '0xe79c32fc1649feebc4f2bebe155c9b0872a51786f875b8563c52500a780d4b5a',
 *		v: '0x29',
 *		r: '0x7a83ab528fcfbe7f003ccd4860d26009f83b5c6976157bb3a00b484ff1acb5c',
 *		s: '0x5a0b1ec15862dcb87c7e969b4af7092eb9ef4bf7d5c9a56f7d1e10042da09cdf',
 *		rawTransaction: '0xf89435843b9aca008288e08080b844e6f1f0ce0000000000000000000000001773ee2ff5bb68962ae57086f949b60a4353ce9b0000000000000000000000000000000000000000000000000bb29fe2f5109cef29a007a83ab528fcfbe7f003ccd4860d26009f83b5c6976157bb3a00b484ff1acb5ca05a0b1ec15862dcb87c7e969b4af7092eb9ef4bf7d5c9a56f7d1e10042da09cdf' }
	*/
function getTxSendGoods(buyer, goods){
	return contract.methods.sendGoods(buyer, goods).estimateGas({from:contract_manager.address})
		.then((estimateGas)=>{
			let abi = contract.methods.sendGoods(buyer, goods).encodeABI();
			let transaction = {
				to: contract.options.address,
				data: abi,
				gas: estimateGas
			};

			console.log("EstimateGas - "+ estimateGas);
			console.log("Transaction - "+ JSON.stringify(transaction) );
			return contract_manager.signTransaction(transaction);
		});
}

function handleOrderError( err, req, res ){
	console.log( colors.error(err.message) );
	console.log( colors.error(req.body) );
	// 412 Precondition Failed
	res.status(412).send( err.toString() );
}

module.exports = router;
