var mongoose = require('mongoose');

var Schema = mongoose.Schema;
var ObjectId = Schema.Types.ObjectId;

var orderSchema = new Schema({

	address: String,
	amount_ether: String,		// Wei
	amount_payment: Number,
	price_id: ObjectId,
	ordered_at: { type: Date, default: Date.now },
	bill_id: { type : ObjectId, default : null } 

}, { versionKey: false});

module.exports = mongoose.model('order', orderSchema);
