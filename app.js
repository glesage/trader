// /* Dependencies */
const Sheet = require('./lib/sheet');
const Trader = require('./lib/trader');
const Boot = require('./lib/boot');
const Order = require('./lib/order');
const Logger = require('./lib/logger');
const Bitfinex = require('./lib/bitfinex');

const bitOptions = {
    rest_key: process.env.BIT_REST_KEY,
    rest_secret: process.env.BIT_REST_SECRET,
    socket_key: process.env.BIT_WS_KEY,
    socket_secret: process.env.BIT_WS_SECRET,
    no_trade_time: process.env.NO_TRADE_TIME
};

/**
 * Instanciate helpers
 */
let trader;
const boot = new Boot();
const sheet = new Sheet();
const logger = new Logger(trader, sheet);
const bitfinex = new Bitfinex(bitOptions, gotTrade, gotOrderUpdate);

/**
 * Main datastructure recording state
 */
let data = {
    positions: [],
    activeBuy: null,
    activeSell: null
};
let makingOrder = false;

boot.init(bitfinex, function (accountData, feesData)
{
    data = accountData;
    trader = new Trader(feesData, placeOrder);

    startLogging();
});

function gotTrade(trade)
{
    if (trader) trader.gotTrade(trade, data);
}

function gotOrderUpdate(order)
{
    console.log('gotOrderUpdate');
    console.log(order);

    // Ignore fee orders
    if (order.status.indexOf('@') > -1) return;

    bitfinex.getActivePositions(function ()
    {
        if (order.status.indexOf('CANCELED') > -1)
        {
            data.activeBuy = null;
            data.activeSell = null;
        }

        logger.orderUpdate(order);
    });
}

function placeOrder(order)
{
    if (makingOrder || !order) return;

    makingOrder = true;
    bitfinex.placeOrder(order, function (err, res)
    {
        makingOrder = false;
        if (err || !res)
        {
            console.log('Could not perform trade or update');
            console.log(err);
            return;
        }

        const newOrder = new Order.FromRestA(res);

        // Record to active order
        if (newOrder.type === 'buy') data.activeBuy = newOrder;
        else if (newOrder.type === 'sell') data.activeSell = newOrder;
    });
}

/**
 * Log in drive what the trader is thinking
 * for debugging purposes
 */
function startLogging()
{
    function logStatus()
    {
        let logData = Object.assign(
        {
            timestamp: Date.now(),
            average: trader.currentAverage,
            stopLossPrice: trader.stopLossPrice,
            minSellPrice: trader.minSellPrice
        }, data, trader.activeData);

        const positions = data.positions;
        if (positions && positions.length)
        {
            logData.boughtAt = positions[0].price;
        }

        sheet.recordTraderData(logData).catch(console.log);
    }

    // Current operation status check every second
    setInterval(function ()
    {
        if (trader.activeData.sellPrice) logStatus();
    }, 1000);

    // Main status check every minute
    setInterval(function ()
    {
        const busySelling = trader.activeData.sellPrice;
        const avgTrades = trader.average.tradesInAverage();

        if (!busySelling && avgTrades > 3) logStatus();
    }, 60000);

    // Low activity status check every 5 minutes
    setInterval(function ()
    {
        const busySelling = trader.activeData.sellPrice;
        const avgTrades = trader.average.tradesInAverage();

        if (!busySelling && avgTrades <= 3) logStatus();
    }, 300000);
}