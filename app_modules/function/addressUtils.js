let web3 = require('web3');

// ====== Address Checksum =========================
let isValidAddress = function (address){
	return new Promise((resolve, reject)=>{
		if( address && 
			web3.utils.isAddress( address ) && 
			web3.utils.checkAddressChecksum (address ) ){
			resolve();
		} else {
			reject( new Error("Address is not Verified") );
		}
	});
}

module.exports = {
	isValidAddress : isValidAddress
};
