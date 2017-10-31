var app = require('./config/routes');

app.set('views', __dirname + '/views');
app.set('view engine', 'pug')

app.listen('3000', function (req, res) {
  console.log('Hello World');
});