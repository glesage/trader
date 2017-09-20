/* Dependencies */
const Bitfinex = require('bitfinex-api-node');
const Order = require('./order');
const Position = require('./position');

function bitfinex(options, gotTrade, gotOrderUpdate)
{
    const self = this;

    self.rest = new Bitfinex(options.rest_key, options.rest_secret).rest;
    self.placeOrder = placeOrder;
    self.gotTrade = gotTrade;
    self.gotOrderUpdate = gotOrderUpdate;

    self.getUpdatedBalance = getUpdatedBalance;
    self.getActivePositions = getActivePositions;
    self.getActiveOrders = getActiveOrders;
    self.getFees = getFees;

    self.status = 'blank';

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
        // symbol, amount, price, exchange, side, type
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

    function getUpdatedBalance(callback)
    {
        if (self.status === 'updating_balance') return;
        self.status = 'updating_balance';

        self.rest.margin_infos(function (err, res)
        {
            if (err || !res || !res.length)
            {
                self.status = 'ready';
                callback(err);
                return;
            }

            try
            {
                let usdBalance = res[0].tradable_balance;
                if (usdBalance) usdBalance = parseFloat(usdBalance);
                self.status = 'ready';
                callback(null, usdBalance);
            }
            catch (e)
            {
                self.status = 'error';
                callback(e);
            }
        });
    }

    function getActivePositions(callback)
    {
        if (self.status === 'updating_positions') return;
        self.status = 'updating_positions';

        self.rest.active_positions(function (err, res)
        {
            if (err || !res)
            {
                self.status = 'error';
                callback(err);
                return;
            }

            if (!res.length)
            {
                self.status = 'ready';
                callback(null, res);
                return;
            }

            try
            {
                const positions = res.map((p) => new Position.FromRest(p));
                self.status = 'ready';
                callback(null, positions);
            }
            catch (e)
            {
                self.status = 'error';
                callback(e);
            }
        });
    }

    function getActiveOrders(callback)
    {
        if (self.status === 'updating_orders') return;
        self.status = 'updating_orders';

        self.rest.active_orders(function (err, res)
        {
            if (err || !res)
            {
                self.status = 'error';
                callback(err);
                return;
            }

            if (!res.length)
            {
                self.status = 'ready';
                callback(null, res);
                return;
            }

            try
            {
                const activeOrder = new Order.FromRestA(res[0]);

                self.status = 'ready';
                callback(null, activeOrder);
            }
            catch (e)
            {
                self.status = 'error';
                callback(e);
            }
        });
    }

    function getFees(callback)
    {
        if (self.status === 'updating_fees') return;
        self.status = 'updating_fees';

        self.rest.account_infos(function (err, res)
        {
            if (err || !res || !res.length)
            {
                self.status = 'error';
                callback(err);
                return;
            }

            try
            {
                let fees = {};
                if (res[0].maker_fees) fees.maker = parseFloat(res[0].maker_fees) / 100;
                if (res[0].taker_fees) fees.taker = parseFloat(res[0].taker_fees) / 100;

                self.status = 'ready';
                callback(null, fees);
            }
            catch (e)
            {
                self.status = 'error';
                callback(e);
            }
        });
    }
}

module.exports = bitfinex;