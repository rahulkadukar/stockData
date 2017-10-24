### Stock data queries

##### Distinct Stocks

This query gives us a list of all the unique stocks that exist in the database.

```sql
  SELECT DISTINCT ticker
  FROM "stocks"."stockData"
```
##### Data per year

This query returns the number of data points per calendar year

```sql
  SELECT date_trunc('year', date) AS year,
         COUNT(*) 
  FROM stocks."rawData"
  GROUP BY year
  ORDER BY year;
```

##### Data per ticker

This query returns the number of data points per ticker, sorted in descending order

```sql
  SELECT ticker, COUNT(*) AS total
  FROM stocks."stockData"
  GROUP BY ticker
  ORDER BY total DESC;
```