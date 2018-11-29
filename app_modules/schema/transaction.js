/* 이더리움 판매 관련 스키마 */

// ====== Order data Schema =========================
var Order = require('../../models/order')
var mkOrder = (data, amount_ether)=>{
	var order = new Order();

	order.address = data.address;
	order.token = data.token;
	order.amount_ether = amount_ether;
	order.amount_payment = data.amount;
	order.price_id = data.price_id;
	order.bill_id = null;

	order.set('toJSON', { getters:true, virtuals: false });

	return order;
};

// ====== Payment data Schema =========================
var Bill = require('../../models/bill');
var mkBill = (data)=>{
	var bill = new Bill();

	bill.receipt_id = data.receipt_id;
	bill.order_id = data.order_id;
	bill.price = data.price;
	bill.name = data.item_name;
	bill.pg = data.pg;
	bill.method = data.method;
	bill.requested_at = data.requested_at;
	bill.purchased_at = data.purchased_at;
	bill.status = data.status;

	bill.set('toJSON', {getters:true, virtuals: false});

	return bill;
};

module.exports = {
	Order : Order,
	mkOrder : mkOrder,

	Bill : Bill,
	mkBill : mkBill
}
