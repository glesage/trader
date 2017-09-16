/* Dependencies */
const BitfinexWS = require('bitfinex-api-node');
const Order = require('./order');
const toFixed = require('./utilities').fixedDecimals;

function bitfinex(gotTrade, gotOrderUpdate)
{
    const self = this;

    self.rest = new BitfinexWS(process.env.BIT_REST_KEY, process.env.BIT_REST_SECRET).rest;
    self.placeOrder = placeOrder;
    self.replaceOrder = replaceOrder;
    self.gotTrade = gotTrade;
    self.gotOrderUpdate = gotOrderUpdate;
    self.getUpdatedBalances = getUpdatedBalances;

    const updatingBalances = false;
    const bws = new BitfinexWS(process.env.BIT_WS_KEY, process.env.BIT_WS_SECRET).ws;

    bws.on('trade', onTrade);
    bws.on('tu', onOrderUpdate);
    bws.on('on', onOrderCreation);
    bws.on('oc', onOrderCancel);
    bws.on('error', console.error);

    self.start = function ()
    {
        bws.subscribeTrades('BTCUSD');
        bws.auth();
    };

    return self;


    function placeOrder(order, madeOrderCallback)
    {
        self.rest.new_order(
            order.symbol,
            order.amount,
            order.price,
            order.exchange,
            order.side,
            order.type,
            madeOrderCallback);
    }

    function replaceOrder(orderId, newOrder, updatedOrderCallback)
    {
        self.rest.replace_order(
            orderId,
            newOrder.symbol,
            newOrder.amount,
            newOrder.price,
            newOrder.exchange,
            newOrder.side,
            newOrder.type,
            updatedOrderCallback);
    }

    function onTrade(pair, trade)
    {
        if (trade) self.gotTrade(new Order.fromSocketT(trade));
    }

    function onOrderUpdate(orderUpdate)
    {
        if (!orderUpdate || !orderUpdate.length) return;
        const order = new Order.fromSocketU(orderUpdate);
        self.gotOrderUpdate(order);
    }

    function onOrderCreation(newOrder)
    {
        if (!newOrder || !newOrder.length) return;
        const order = new Order.fromSocketN(newOrder);
        self.gotOrderUpdate(order);
    }

    function onOrderCancel(rawOrder)
    {
        if (!rawOrder || !rawOrder.length) return;
        const order = new Order.fromSocketN(rawOrder);
        self.gotOrderUpdate(order);
    }

    function getUpdatedBalances(callback)
    {
        if (updatingBalances) return;

        updatingBalances = true;
        self.rest.wallet_balances(function (err, res)
        {
            if (err || !res || !res.length)
            {
                updatingBalances = false;
                return callback();
            }

            const btcBalance = res.find(function (b)
            {
                return b.currency === "btc" && b.type === 'exchange';
            });
            const usdBalance = res.find(function (b)
            {
                return b.currency === "usd" && b.type === 'exchange';
            });
            const balances = {};
            try
            {
                if (btcBalance) balances.balanceBTC = parseFloat(btcBalance.available);
                if (usdBalance) balances.balanceUSD = parseFloat(usdBalance.available);
            }
            catch (e)
            {
                console.log("Error parsing balances");
                console.log(e);
            }

            updatingBalances = false;
            return callback(balances);
        });
    }
}

module.exports = bitfinex;