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
initializeCalculations();

function parsePostgresOutput(pgsqlData) {
  let str = JSON.stringify(pgsqlData);
  let output = JSON.parse(str);
  return output.rows;
}

var t0 = (new Date).getTime();
var stockData = [];
let totalCount = 0;

function initializeCalculations() {
  var sql = 'SELECT ticker, COUNT(*) AS total FROM "stocks"."stockData" ' +
    'WHERE "tickerDate" > \'2010-01-01\' GROUP BY ticker';
  
  pgsql.query(sql, function (err, rows) {
    if (err) { 
      console.log(sql);
    } else {
      let result = parsePostgresOutput(rows);

      for (var x in result) { 
        stockData.push(result[x]);
      }

      for (let x in stockData) {
        let y = (stockData[x].total);
        let dynamic = [5, 10, 20, 30, 40, 50, 100, 200];

        for (let a in dynamic) {
          let z = y - dynamic[a];
          if (z > 0) {
            totalCount += z;
          }
        }
      }

      console.log(totalCount);
      console.log((new Date).getTime() - t0 + " µs");
      process.exit();
    }
  });
}
