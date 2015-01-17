require('./funcs/funcs.js');
var config = require('./config.json'), orderid = config.orderid, fs = require('fs');
var users = require('./users.json');

var book = {
  "buy": [], "sell": []
};
var serv = server();

function verifyCancel(bookside, orderid, userid){
  for(var i=0; i < bookside; i++){
    if(bookside[i].orderid == orderid && bookside.userid == userid){
      bookside.splice(i, 1);
      dumpbook(userid);
      return s.end(JSON.stringify({result: 'cancelled', orderid: orderid}));
    }
  }
  return s.end(JSON.stringify({result: 'invalid request'}));
}

function verifyOrder(userid, type, size, price){
  if(isNaN(size) || isNaN(price) || !userid)
    return null;
  orderid++; config.orderid = orderid; fs.writeFileSync('./config.json', JSON.stringify(config, null, 2));
  return {orderid: orderid++, type: type, userid: userid, size: size, price: Number(price).toFixed(2)};
}

function firstOrderOnBook(order, disp){
  book[disp].push(order); dumpbook(order.userid); order.result = 'confirmed'; 
  return JSON.stringify(order);
}

function badorder(s){
  return s.end('{"error": "invalid order"}');
}

serv.get('/api/new/:info', function(r, s){
  var id = req.params.info;
  if(!id || !require('bitcoin-address').validate(id)) return badorder(s);
  users[id] = {balance: 1000};
  fs.writeFileSync(JSON.stringify(users, null, 2), './users.json');
  return s.end('{"result": "user created"}');
});

serv.get('/api/account/:userid', function(r, s){
  var id = req.params.userid;
  return s.end(JSON.stringify(users[id]));
});

serv.get('/api/cancel/:userid/:orderid', function(r, s){
  verifyCancel(book.buy, req.params.orderid, req.params.userid);
  verifyCancel(book.sell, req.params.orderid, req.params.userid);
});

serv.get('/api/:type/:userid/:size/:price', function(r, s){
  if(type != 'buy' && type != 'sell') return badorder(s);
  var nottype = type=='buy' ? 'sell':'buy';
  var order = verifyOrder(req.params.userid, 'buy', req.params.size, req.params.price);
  if(!order) return badorder(s);  
  var result = [];
  if(!book[nottype].length)
    return s.end(firstOrderOnBook, type);  

  for(var i=0; i < book[type].length; i++){
    var restingorder = book[nottype][i];
    if((type=='buy' && order.price < restingorder.price) || (type=='sell' && order.price > restingorder.price)){
      book[type].push(order);
      dumpbook(userid);
      return s.end(JSON.stringify([order]));
    }
    var disp = restingorder.size - order.size;
    if(disp > -1){ // all filled
      result.push({result: type, size: order.size, price: restingorder.price});
      book[nottype][i].size = disp;
      if(disp == 0) book[type].splice(i, 1);
      dumpbook(r.params.userid);
      return s.end(JSON.stringify(result));
    }
  }
  return badorder(s);
});

serv.get('/api/book', function(r, s){
  return s.end(JSON.stringify(book));
});

serv.get('/api/orders/:userid', function(r, s){
  var userid = req.params.userid;
  var orders = JSON.parse(JSON.stringify(book));
  orders.buy = orders.buy.filter(function(order){ return order.userid == userid });
  orders.sell = orders.sell.filter(function(order){ return order.userid == userid });
  return s.end(JSON.stringify({orders: orders}));
});

serv.get('/api*', function(r, s){
  return s.end(JSON.stringify({result: 'invalid request'}));
});

function dumpbook(userid){
  book.buy = book.buy.sort(function(a,b){return +a.price < +b.price});
  book.sell = book.sell.sort(function(a,b){return +a.price > +b.price});

  var sanitized = JSON.parse(JSON.stringify(book));
  sanitized.buy = sanitized.buy.filter(function(order){ delete order.userid; return order; })
  sanitized.sell = sanitized.sell.filter(function(order){ delete order.userid; return order; })

  sanitized.buy = sanitized.buy.slice(0,5);
  sanitized.sell = sanitized.sell.slice(0,5);

  console.log(JSON.stringify({book: sanitized}, null, 2));
  sse.send({book: sanitized});
  
  if(userid){
    var orders = JSON.parse(JSON.stringify(book));
    orders.buy = orders.buy.filter(function(order){ return order.userid == userid });
    orders.sell = orders.sell.filter(function(order){ return order.userid == userid });

    console.log(JSON.stringify({orders: orders}, null, 2));
    sse.send({orders: orders});
  }
}

var clients = {};
var sse = {
  handle: function(r, s){
    s.setHeader('Content-Type', 'text/event-stream');
    s.setHeader('Access-Control-Allow-Origin', '*');
    clients[r.cookies && r.cookies.t || Date.now()] = s;
  },

  send: function(msg){
    if(typeof msg !== 'string')
      msg = JSON.stringify(msg);
    
    for(i in clients)
      clients[i].write('data:'+msg+'\n\n');
  }
};

serv.get('/feed', sse.handle);
