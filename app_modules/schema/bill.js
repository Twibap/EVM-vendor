
// ====== Payment data Schema =========================
var Bill = require('./models/bill');
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
}

module.exports = {
	mkBill : mkBill
};
