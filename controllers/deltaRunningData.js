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

let tickerData = ['MDM'];
let totalTickers;
let batchSize = 200;
var t0;
var timeStart = (new Date).getTime();

function zeroPad(x) {
  let num = x.toString();
  while (num.length < 3) {
    num = '0' + num;
  }
  return num;
}

function parsePostgresOutput(pgsqlData) {
  let str = JSON.stringify(pgsqlData);
  let output = JSON.parse(str);
  return output.rows;
}

pgsql.connect()
deltaRunning().then(() => {
  process.exit();
})

function deltaRunning() {
  return new Promise((resolve, reject) => {
    let promises = [];
    for (let x = 0; x < tickerData.length; ++x) {
      promises.push(deleteExistingData(tickerData[x]));
    }

    Promise.all(promises).then(() => {
      console.log('COMPLETED PROCESSING');
      resolve();
    });
  });
}

function deleteExistingData(ticker) {
  return new Promise((resolve, reject) => {
    let sql = 'DELETE FROM "stocks"."runningAvg" WHERE ticker = \'' + ticker + '\'';
    pgsql.query(sql, (err, result) => {
      if (err) {
        console.log('Error in deleting data for ticker ' + ticker);
      } else {
        calculateRunningAverage(ticker).then(() => {
          console.log('Processing completed for ' + ticker);
          resolve();
        });
      }
    });
  });
}

function calculateRunningAverage(ticker) {
  return new Promise((resolve, reject) => {
    let movingAvg = {};    
    let stockData = [];
    let fetchQuery = 'SELECT * FROM "stocks"."stockData" WHERE "ticker" = \'' + ticker +
      '\' AND "tickerDate" > \'2009-01-01\' ORDER BY "tickerDate" ASC';
    
    pgsql.query(fetchQuery, (err, result) => {
      if (err) {
        console.log("Error in fetching data for ticker " + ticker);
        resolve();
      } else {
        let oData = parsePostgresOutput(result);
        let promises = [];

        for (let x in oData) {
          stockData.push(oData[x]);
        }

        let intervals = [5, 10, 30, 50, 100, 200];

        for (let a in intervals) {
          let start = 0;
          let stop = 0;
          let openAvg = 0.0000;
          let duration = 'm' + zeroPad(intervals[a]);
          movingAvg[duration] = [];
          
          let mover = intervals[a];
    
          for (let y in stockData) {
            if (stop - start === mover) {
              start++;
              stop++;
              let avgRecord = {};
              avgRecord.avgDate = stockData[y].tickerDate.slice(0, 10);
              avgRecord.price = ((openAvg / mover).toFixed(2));
              movingAvg[duration].push(avgRecord);
              openAvg -= (stockData[y - mover].closePrice + stockData[y - mover].openPrice) / 2;
            } else {
              stop++;
            }
            openAvg = openAvg + ((stockData[y].closePrice + stockData[y].openPrice) / 2);
          }        
        }

        let x = 0;
        let maxLength = 12;

        for (let a = 0; a < maxLength; ++a) {
          promises.push(insertDataIntoTable(x, ticker, movingAvg));
          x++;
        }

        Promise.all(promises).then(() => {
          resolve();
        });
      }
    });
  });
}

function insertDataIntoTable(i, ticker, movingAvg) {
  let counter = 0;
  let queryBreak = 500;
  let initQuery = 'INSERT INTO "stocks"."runningAvg" ' + 
    '("ticker", "tickerDate", "avgType", "fields", "price") VALUES ';
  let rawQuery = initQuery;

  let beginCount = i * queryBreak;
  let endCount = beginCount + queryBreak;

  return new Promise((resolve, reject) => {
    for (let a in movingAvg) {
      while ((beginCount < endCount)) {
        if (movingAvg[a].length < (beginCount + 1)) {
          break;
        }
  
        rawQuery += '(\'' + ticker + '\', \'' + movingAvg[a][beginCount].avgDate + '\', \'' + a +
        '\', \'OC\', \'' + movingAvg[a][beginCount].price + '\'), '; 
        beginCount++;
        counter++;
      }
      beginCount = i * queryBreak;
    }
  
    if (rawQuery === initQuery) {
      resolve();
    } else {
      pgsql.query(rawQuery.slice(0, -2), (err, result) => {
        if (err) {
          console.log("Error in inserting data for ticker " + ticker + " for i " + i);
          console.log(err);
        }
        resolve();
      })
    }
  });
}
