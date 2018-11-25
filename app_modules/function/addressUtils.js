let web3 = require('web3');

// ====== Address Checksum =========================
let isValidAddress = function (address){
	return address && 
		web3.utils.isAddress( address ) && 
		web3.utils.checkAddressChecksum( address );
}

module.exports = {
	isValidAddress : isValidAddress
};
