module.exports = {
	id: 'tp',
	port: 3010,
	mongo: {host: process.env.MONGO_PORT_27017_TCP_ADDR, port: process.env.MONGO_PORT_27017_TCP_PORT, db: 'tp'},
	secretKey: 'secretKey',
	url: null,
	buildboardUrl: null
};