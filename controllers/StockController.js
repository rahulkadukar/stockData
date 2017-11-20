const { Client } = require('pg');
const promise = require('promise');
const dbConnection = require('./privateSettings');

function parsePostgresOutput(pgsqlData) {
  let str = JSON.stringify(pgsqlData);
  let output = JSON.parse(str);
  return output.rows;
}

exports.showStocks = function (req, res) {
  const pgsql = new Client({
    user: dbConnection.user,
    host: dbConnection.host,
    database: dbConnection.database,
    password: dbConnection.password,
    port: dbConnection.port
  })

  pgsql.connect();

  var t0 = (new Date).getTime();;
  var sql;
  
  sql = 'SELECT * FROM "stocks"."stockData" WHERE "ticker" = \'' + req.params.stock + '\' ORDER BY "tickerDate" ASC';
  var stockData = [];
  pgsql.query(sql, function (err, rows) {
    if (err) { 
      console.log('Error in executing the SQL query');  
    } else {
      let result = parsePostgresOutput(rows);
      
      // The output of this operation is a JSON string with the following structure
      // --> ticker
      // --> tickerDate
      // --> openPrice
      // --> highPrice
      // --> lowPrice
      // --> closePrice
      // --> volumeTotal

      var tempData = [];
      for (var x in result) {
        stockData.push(result[x]);
        tempData.push(result[x]);
      }

      var dynamic = [30, 50, 100, 200];
      var movingAvg = {};
      movingAvg['m0'] = [];
    
      for (var a in dynamic) {
        var start = 0;
        var stop = 0;
        var openRunningAvg = 0.0000;
        var duration = 'm' + dynamic[a];
        movingAvg[duration] = [];
        var mover = dynamic[a];
        for(var x in stockData) {
          if (stop - start == mover) {
            start++;
            stop++;
            stockAvgData = [];
            stockAvgData.push((new Date(stockData[x].tickerDate.replace(' ', 'T')).getTime()));
            stockAvgData.push(openRunningAvg / mover);
            openRunningAvg -= ((stockData[x - mover].closePrice + stockData[x - mover].openPrice ) / 2);
            movingAvg[duration].push(stockAvgData);
          } else {
            stop++;
          }
          openRunningAvg += ((stockData[x].closePrice + stockData[x].openPrice) / 2);
        }
      }

      var ohlcData = [];
      for(var x in stockData) {
        var a = [];
        a.push((new Date(stockData[x].tickerDate.replace(' ', 'T')).getTime()));
        a.push(stockData[x].closePrice);
        ohlcData.push(a);
      }
      
      movingAvg['m0'] = ohlcData;
      var payload = {};
      payload.data = ohlcData; 
      payload.avg = movingAvg;
      payload.stock = req.params.stock
      payload.time = (new Date).getTime() - t0;
      res.render('index', { name: req.params.stock , data: JSON.stringify(payload)});  
    }
  });
}

exports.candleStocks = function (req, res) {
  const pgsql = new Client({
    user: dbConnection.user,
    host: dbConnection.host,
    database: dbConnection.database,
    password: dbConnection.password,
    port: dbConnection.port
  })

  pgsql.connect();

  var t0 = (new Date).getTime();;
  var sql;
  
  sql = 'SELECT * FROM "stocks"."stockData" WHERE "ticker" = \'' + req.params.stock + '\' ORDER BY "tickerDate" ASC';
  var stockData = [];
  pgsql.query(sql, function (err, rows) {
    if (err) { 
      console.log('Error in executing the SQL query');  
    } else {
      let result = parsePostgresOutput(rows);
      
      // The output of this operation is a JSON string with the following structure
      // --> ticker
      // --> tickerDate
      // --> openPrice
      // --> highPrice
      // --> lowPrice
      // --> closePrice
      // --> volumeTotal

      var tempData = [];
      for (var x in result) {
        stockData.push(result[x]);
        tempData.push(result[x]);
      }

      var dynamic = [30, 50, 100, 200];
      var movingAvg = {};
    
      for (var a in dynamic) {
        var start = 0;
        var stop = 0;
        var openRunningAvg = 0.0000;
        var highRunningAvg = 0.0000;
        var lowRunningAvg = 0.0000;
        var closeRunningAvg = 0.0000;
        var duration = 'm' + dynamic[a];
        movingAvg[duration] = [];
        var mover = dynamic[a];
        for(var x in stockData) {
          if (stop - start == mover) {
            start++;
            stop++;
            stockAvgData = [];
            stockAvgData.push((new Date(stockData[x].tickerDate.replace(' ', 'T')).getTime()));
            stockAvgData.push(openRunningAvg / mover);
            stockAvgData.push(highRunningAvg / mover);
            stockAvgData.push(lowRunningAvg / mover);
            stockAvgData.push(closeRunningAvg / mover);
            openRunningAvg  = openRunningAvg - stockData[x - mover].openPrice;
            highRunningAvg  = highRunningAvg - stockData[x - mover].highPrice;
            lowRunningAvg   = lowRunningAvg - stockData[x - mover].lowPrice;
            closeRunningAvg = closeRunningAvg - stockData[x - mover].closePrice;
            movingAvg[duration].push(stockAvgData);
          } else {
            stop++;
          }
          openRunningAvg  = openRunningAvg + stockData[x].openPrice;
          highRunningAvg  = highRunningAvg + stockData[x].highPrice;
          lowRunningAvg   = lowRunningAvg + stockData[x].lowPrice;
          closeRunningAvg = closeRunningAvg + stockData[x].closePrice;
        }
      }

      var ohlcData = [];
      for(var x in stockData) {
        var a = [];
        a.push((new Date(stockData[x].tickerDate.replace(' ', 'T')).getTime()));
        a.push(stockData[x].openPrice);
        ohlcData.push(a);
      }
      
      // movingAvg['m0'] = ohlcData;

      var payload = {};
      payload.data = ohlcData; 
      payload.avg = movingAvg; 
      payload.stock = req.params.stock
      payload.time = (new Date).getTime() - t0;
      res.render('candle', { name: req.params.stock , data: JSON.stringify(payload)});  
    }
  });
}

exports.stockData = function (req, res) {
  console.log(req.body);
  var duration;
  if (req.body.duration === undefined || req.body.duration === null) {
    req.body.duration = '1m';
  }

  switch (req.body.duration) {
    case '1m':
      duration = '100';
      break;
    default:
      duration = '10m';
  }

  return showStockData(req, res);
}
