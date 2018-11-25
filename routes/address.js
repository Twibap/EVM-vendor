let express = require('express');
let router = express.Router();

let addressUtils = require('../app_modules/function/addressUtils');

router.get('/toChecksum/:address', (request, response)=>{
	let checksumAddress = web3.utils.toChecksumAddress(request.params.address);
	console.log(checksumAddress);
	response.json( checksumAddress );
});

router.get('/isValid/:address', (request, response)=>{
	response.json( addressUtils.isValidAddress( request.params.address ) );
});

module.exports = router;
