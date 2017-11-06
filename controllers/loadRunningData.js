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

let totalTickers;
let batchSize = 200;
var t0;
var timeStart = (new Date).getTime();
var tickerData = [];

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
initializeCalculations();

function initializeCalculations() {
  let countTickerQuery = 'SELECT COUNT(*) FROM ' +
  '(SELECT DISTINCT ticker FROM "stocks"."stockData") AS temp';

  pgsql.query(countTickerQuery, (err, result) => {
    if (err) {
      console.log("Issue in determining count of tickers");
    } else {
      totalTickers = parsePostgresOutput(result);
      t0 = (new Date).getTime();
      preFetchData();
    }
  })
}

function preFetchData() {
  let allTickerQuery = 'SELECT DISTINCT ticker FROM "stocks"."stockData" ' +
    'ORDER BY ticker ASC';
  
  pgsql.query(allTickerQuery, (err, result) => {
    if (err) {
      console.log("Issue in fetching all distinct tickers");
    } else {
      let allTickers = parsePostgresOutput(result);
      fetchMaxDate(allTickers);
    }
  });
}

function fetchMaxDate(allTickers) {
  let maxTimeQuery = 'SELECT "ticker", MAX("tickerDate") AS "maxDate" FROM "stocks"."runningAvg" ' +
  'GROUP BY "ticker" ORDER BY "ticker" ASC';
  pgsql.query(maxTimeQuery, (err, result) => {
    if (err) {
      console.log("Error in fetching max date from running Average");
    } else {
      maxTime = parsePostgresOutput(result);

      let z = (new Date).getTime();
      allTickers.push({'ticker': 'XXXX'});
      for (let x in allTickers) {
        let tickerDateData = {};
        let something = -1;
        maxTime.find((element, index) => {
          if (allTickers[x].ticker === element.ticker) {
            something = index;
            let maxDate = element.maxDate.slice(0, 10);
            tickerDateData.maxDate = maxDate;
            let yearMaxDate = (maxDate.slice(0,4) - 1).toString();
            tickerDateData.tickerDate = yearMaxDate + '-' +
              maxDate.slice(5,7) + '-' + maxDate.slice(8,10);
          }
        });

        if (something === -1) {
          tickerDateData.tickerDate = '2009-01-01';
          tickerDateData.maxDate = '2009-01-01';;
        }

        tickerDateData.ticker = allTickers[x].ticker;
        tickerData.push(tickerDateData);
      }

      let zf = (new Date).getTime() - z;
      console.log('Time taken to prepare the tickerData ' + zf + ' µs');
      startDataFetch(0);
    }  
  })
}

function startDataFetch(e) {
  if (e > totalTickers[0].count) {
    let z = (new Date).getTime() - timeStart;
    console.log('Total time taken: ' + z + ' µs');
    process.exit();
    return;
  } else {
    fetchData(e).then(() => {
      startDataFetch(e + batchSize);
    });
  }
}

function fetchData(e) {
  let x = 10;

  return new Promise((resolve, reject) => {
    let promises = [];
    let beginStock = tickerData[e].ticker;
    let endStock;

    for (let x = 0; x < tickerData.length; ++x) {
      if (x >= e && x < (e + batchSize)) {
        promises.push(calculateRunningAverage(tickerData[x]));
        endStock = tickerData[x].ticker;
      }
    }

    Promise.all(promises).then(() => {
      let z = (new Date).getTime() - t0;
      console.log(beginStock + ' to ' + endStock + ' took ' + z + ' µs');
      t0 = (new Date).getTime();
      resolve();
    });
  });
}

function calculateRunningAverage(ticker) {
  return new Promise((resolve, reject) => {
    let movingAvg = {};    
    let stockData = [];
    let fetchQuery = 'SELECT * FROM "stocks"."stockData" WHERE "ticker" = \'' + ticker.ticker +
      '\' AND "tickerDate" > \'' + ticker.tickerDate + '\' ORDER BY "tickerDate" ASC';
    
    pgsql.query(fetchQuery, (err, result) => {
      if (err) {
        console.log("Error in fetching data for ticker " + ticker.ticker);
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
              if (ticker.maxDate < avgRecord.avgDate) {
                movingAvg[duration].push(avgRecord);
              }
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
          promises.push(insertDataIntoTable(x, ticker.ticker, movingAvg));
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