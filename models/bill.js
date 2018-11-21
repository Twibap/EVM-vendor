var mongoose = require('mongoose');

var Schema = mongoose.Schema;
var ObjectId = Schema.Types.ObjectId;

/*
 * 	{ receipt_id: '5bf3cea6ed32b313e701f76a',
 * 		order_id: '5bf3cea67dc442319dec5e67',
 * 		name: 'Item22000',
 * 		price: 22000,
 * 		unit: 'krw',
 * 		pg: 'kakao',
 * 		method: 'easy',
 * 		pg_name: '카카오페이',
 * 		method_name: '카카오페이',
 * 		payment_data: 
 * 			{ receipt_id: '5bf3cea6ed32b313e701f76a',
 * 				n: 'Item22000',
 * 				p: 22000,
 * 				pg: '카카오페이',
 * 				pm: '카카오페이',
 * 				pg_a: 'kakao',
 * 				pm_a: 'easy',
 * 				o_id: '5bf3cea67dc442319dec5e67',
 * 				p_at: '2018-11-20',
 * 				r_at: null,
 * 				s: 1,
 * 				g: 22 },
 * 		requested_at: '2018-11-20 18:06:46',
 * 		purchased_at: '2018-11-20 18:06:56',
 * 		status: 1 }
 */

var billSchema = new Schema({

  "receipt_id": ObjectId, 
  "order_id": ObjectId, 
  "name": String, 
  "price": Number, 
	"unit" : { type: String, default: 'krw'},
	"pg" : String,
	"method" : String,
  "requested_at": String, 
  "purchased_at": String, 
  "status": Number 

}, { versionKey: false});

module.exports = mongoose.model('bill', billSchema);
