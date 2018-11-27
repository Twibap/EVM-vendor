let requireFromUrl = require('require-from-url/sync');
let Price = requireFromUrl(
	'https://raw.githubusercontent.com/Twibap/EVM-priceboard/master/models/price.js');

let Web3 = require('web3');
let web3 = new Web3();

// Promise return BN
let getGoodsAmount = function (price_id, payment_price, balance){
	return new Promise((resolve, reject)=>{
		Price.findById( price_id ).exec(
			(error, price)=>{
				if(error) reject( Error(error) );

				// 이더 갯수(wei) = 결제 가격(원) * wei단위 / 이더 가격(원)
				// 결제 가격과 이더 가격을 BigNumber로 변환하여 연산.
				let wei_ether_price = web3.utils.toBN( price.trade_price );	
				let wei_payment_price = web3.utils.toWei( web3.utils.toBN( payment_price) );	// toWei return type BN

				//let goodsAmount = payment_price / ether_price;
				let goodsAmount = wei_payment_price.div( wei_ether_price );
				console.log("Goods Amount  - "+goodsAmount);

				balance = web3.utils.toBN(balance);
				// BN.js compairement 
				// a.cmp(b) - compare numbers 
				// return -1 (a < b), 0 (a == b), or 1 (a > b) 
				// depending on the comparison result (ucmp, cmpn)
				if( goodsAmount.cmp(balance) === 1 )	// goodsAmount > balance
					reject( Error("Not Enough") );
				else
					resolve(goodsAmount);
			});
	});
}

module.exports = {
	getGoodsAmount: getGoodsAmount
}
