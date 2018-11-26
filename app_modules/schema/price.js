let requireFromUrl = require('require-from-url/sync');
let Price = requireFromUrl(
	'https://raw.githubusercontent.com/Twibap/EVM-priceboard/master/models/price.js');
let getGoodsAmount = function (price_id, payment_price, balance){
	return new Promise((resolve, reject)=>{
		Price.findById( price_id ).exec(
			(error, price)=>{
				if(error) reject( Error(error) );

				// 이더 갯수 = 결재가격 / 이더 가격
				let ether_price = price.trade_price;
				let goodsAmount = payment_price / ether_price;
				console.log("Goods Amount  - "+goodsAmount);

				if( goodsAmount >= balance )
					reject( Error("Not Enough") );
				else
					resolve(goodsAmount);
			});
	});
}

module.exports = {
	getGoodsAmount: getGoodsAmount
}
