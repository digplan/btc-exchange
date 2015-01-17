API
===

Error returns:  {error: description}

/api/new/:address
 -> {account: userid, balance: balance}

/api/account/:userid
 -> {account: userid, balance: balance}

/api/buy/:userid/:size/:price
 -> {confirmed: orderid}

/api/sell/:userid/:size/:price
 -> {confirmed: orderid}

/api/cancel/:userid/:orderid
 -> {cancelled: orderid}

/api/orders/:userid
 -> {orders: {buy:..., sell:...}}

/api/book
 -> {book: {buy:..., sell:...}}

SSE: /feed
{book: {buy:..., sell:...}}, {orders: {buy:..., sell:...}}