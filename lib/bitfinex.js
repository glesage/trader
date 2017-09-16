/* Dependencies */
const Bitfinex = require('bitfinex-api-node');
const Order = require('./order');

function bitfinex(options, gotTrade, gotOrderUpdate)
{
    const self = this;

    self.rest = new Bitfinex(options.rest_key, options.rest_secret).rest;
    self.placeOrder = placeOrder;
    self.gotTrade = gotTrade;
    self.gotOrderUpdate = gotOrderUpdate;
    self.getUpdatedBalances = getUpdatedBalances;

    self.status = 'blank';

    let updatingBalances = false;
    const bws = new Bitfinex(options.socket_key, options.socket_secret).ws;

    bws.on('trade', onTrade);
    bws.on('tu', onOrderUpdate);
    bws.on('on', onOrderCreation);
    bws.on('oc', onOrderCancel);
    bws.on('error', console.error);

    bws.on('open', () =>
    {
        bws.subscribeTrades('BTCUSD');
        bws.auth();

        self.status = 'open';
    });

    bws.on('auth', () =>
    {
        self.status = 'ready';
    });

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

    function onTrade(pair, trade)
    {
        if (!validateData(trade)) return;
        self.gotTrade(new Order.FromSocketT(trade));
    }

    function validateData(data)
    {
        if (!data) return false;
        if (!data.id) return false;
        if (!data.timestamp) return false;
        if (!data.amount) return false;
        if (!data.price) return false;

        if (!Number.isFinite(parseFloat(data.amount))) return false;
        if (!Number.isFinite(parseFloat(data.price))) return false;

        return true;
    }

    function onOrderUpdate(orderUpdate)
    {
        if (!orderUpdate || !orderUpdate.length) return;
        const order = new Order.FromSocketU(orderUpdate);
        self.gotOrderUpdate(order);
    }

    function onOrderCreation(newOrder)
    {
        if (!newOrder || !newOrder.length) return;
        const order = new Order.FromSocketN(newOrder);
        self.gotOrderUpdate(order);
    }

    function onOrderCancel(rawOrder)
    {
        if (!rawOrder || !rawOrder.length) return;
        const order = new Order.FromSocketN(rawOrder);
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
                return callback(err);
            }

            const btcBalance = res.find(function (b)
            {
                return b.currency === 'btc' && b.type === 'exchange';
            });
            const usdBalance = res.find(function (b)
            {
                return b.currency === 'usd' && b.type === 'exchange';
            });
            const balances = {};
            try
            {
                if (btcBalance) balances.balanceBTC = parseFloat(btcBalance.available);
                if (usdBalance) balances.balanceUSD = parseFloat(usdBalance.available);
            }
            catch (e)
            {
                console.log('Error parsing balances');
                console.log(e);
            }

            updatingBalances = false;
            return callback(null, balances);
        });
    }
}

module.exports = bitfinex;