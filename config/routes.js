var express = require('express');
var app = express();
var bodyParser = require('body-parser');

app.use(bodyParser.json()); // for parsing application/json
app.use(bodyParser.urlencoded({ extended: true })); // for parsing application/x-www-form-urlencoded

var StockController = require('../controllers/StockController');

app.use(express.static('public'))

app.get('/stocks/:stock',StockController.showStocks);
app.post('/stockData', StockController.stockData);
app.get('/candle/:stock',StockController.candleStocks);

module.exports =  app; 