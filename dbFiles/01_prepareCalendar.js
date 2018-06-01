const { Client } = require('pg');
const dbConnection = require('../controllers/privateSettings');

const pgsql = new Client({
  user: dbConnection.user,
  host: dbConnection.host,
  database: dbConnection.database,
  password: dbConnection.password,
  port: dbConnection.port
})

pgsql.connect();
removeCalendarData();

function parsePostgresOutput(pgsqlData) {
  let str = JSON.stringify(pgsqlData);
  let output = JSON.parse(str);
  return output.rows;
}

function removeCalendarData() {
  let sql = 'TRUNCATE "stocks"."calendarData"';
  pgsql.query(sql, function (err, rows) {
    if (err) {
      console.log(err);
    } else {
      prepareCalendarData();      
    }
  });
}

function prepareCalendarData() {
  let sql = 'SELECT DISTINCT "tickerDate" FROM "stocks"."stockData" ' +
    'WHERE "tickerDate" > \'2008-12-31\' ORDER BY "tickerDate" ASC';

  let rawQuery = 'INSERT INTO "stocks"."calendarData" ' +
    '("uuidNumber", "tickerDate") VALUES ';
    
  let uuid = 1;
  
  pgsql.query(sql, (err, rows) => {
    if (err) {
      console.log(err);
    } else {
      let data = parsePostgresOutput(rows);
      for (let x in data) {
        rawQuery += '(\'' + uuid + '\', \'' + data[x].tickerDate.slice(0, 10) + '\'), ';
        uuid++;
      }
    }

    pgsql.query(rawQuery.slice(0, -2), (err, result) => {
      if (err) {
        console.log('Error in inserting data into calendar data');
      } else {
        console.log(uuid + ' rows created successfully');
        process.exit();
      }
    })
  })
}