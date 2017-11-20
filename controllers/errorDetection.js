const { Client } = require('pg');
const promise = require('promise');
const dbConnection = require('./privateSettings');

const pgsql = new Client({
  user: dbConnection.user,
  host: dbConnection.host,
  database: dbConnection.database,
  password: dbConnection.password,
  port: dbConnection.port
})

pgsql.connect()
returnRawCount().then((x) => {
  initializeCalculations(x);
});

function parsePostgresOutput(pgsqlData) {
  let str = JSON.stringify(pgsqlData);
  let output = JSON.parse(str);
  return output.rows;
}

var t0 = (new Date).getTime();
var stockData = [];
var runningData = {};

function initializeCalculations(data) {
  for (let x in data) {
    runningData[data[x]['ticker']] = data[x]['total'];
  }

  let sql = 'SELECT ticker, COUNT(*) AS total FROM "stocks"."stockData" ' +
    'WHERE "tickerDate" > \'2009-01-01\' GROUP BY ticker';
  
  pgsql.query(sql, function (err, rows) {
    if (err) { 
      console.log(sql);
    } else {
      let result = parsePostgresOutput(rows);

      for (let x in result) { 
        let rawData = {};
        rawData.ticker = result[x].ticker;
        rawData.rowCount = result[x].total;
        stockData.push(rawData);
      }

      for (let x in stockData) {
        let y = stockData[x].rowCount;
        let totalCount = 0;
        let dynamic = [5, 10, 30, 50, 100, 200];
        
        for (let a in dynamic) {
          let z = y - dynamic[a];
          if (z > 0) {
            totalCount += z;
          }
        }
        
        stockData[x].totalCount = totalCount;
      }
      
      compareResults(stockData, runningData);
      console.log((new Date).getTime() - t0 + " µs");
      process.exit();
    }
  });
}

function returnRawCount() {
  return new Promise((resolve, reject) => {
    let sql = 'SELECT "ticker", COUNT(*) AS total FROM "stocks"."runningAvg" ' +
      'GROUP BY "ticker"';

    pgsql.query(sql, function (err, rows) {
      if (err) {
        console.log(sql);
      } else {
        let result = parsePostgresOutput(rows);
        resolve(result);
      }
    });
  });
} 

function compareResults(st, ru) {
  let finalList = [];

  for (let x in st) {
    if (ru[st[x].ticker] != undefined) {
      if (ru[st[x].ticker] != st[x].totalCount) {
        console.log(st[x].ticker + ' : ' + st[x].totalCount + ' : ' + ru[st[x].ticker]);
        finalList.push(st[x].ticker);
      }
    } else {
      if (st[x].totalCount !== 0) {
        console.log('ENTRY NOT FOUND: ' + st[x].ticker);
        finalList.push(st[x].ticker);
      }
    }
  }
  
  if (finalList.length !== 0) {
    let str = '[';
    for (let x in finalList) {
      str += '\'' + finalList[x] + '\',';
    }
    str = str.slice(0, -1);
    str += ']';

    console.log(str);
  }
}