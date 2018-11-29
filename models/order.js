var mongoose = require('mongoose');

var Schema = mongoose.Schema;
var ObjectId = Schema.Types.ObjectId;

var orderSchema = new Schema({

	address: String,
	token: String,
	amount_ether: String,		// Wei
	amount_payment: Number,
	price_id: ObjectId,
	bill_id: { type : ObjectId, default : null },
	ordered_at: { type: Date, default: Date.now },
	txHash: {type: String, default: null},
	bkHash: {type: String, default: null}

}, { versionKey: false});

module.exports = mongoose.model('order', orderSchema);
