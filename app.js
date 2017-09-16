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
    socket_secret: process.env.BIT_WS_SECRET
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
    balanceUSD: 0,
    balanceBTC: 0,
    lastBuy: null,
    lastSell: null,
    activeBuy: null,
    activeSell: null
};
let makingOrder = false;

boot.init(bitfinex, function (accountData, feesData)
{
    data = accountData;
    trader = new Trader(feesData, placeOrder);

    logStuff();
});

function gotTrade(trade)
{
    if (trader) trader.gotTrade(trade, data);
}

function gotOrderUpdate(order)
{
    console.log('got order update');
    console.log(order);

    updateBalances(function ()
    {
        // Ignore fee orders
        if (order.status.indexOf('@') > -1) return;

        if (order.status === 'EXECUTED')
        {
            if (order.type === 'buy')
            {
                data.activeBuy = null;
                data.lastBuy = order;
            }
            if (order.type === 'sell')
            {
                data.activeSell = null;
                data.lastSell = order;
            }
        }
        else if (order.status === 'ACTIVE')
        {
            if (order.type === 'buy') data.activeBuy = order;
            if (order.type === 'sell') data.activeSell = order;
        }
        else if (order.status === 'CANCELED')
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

        trader.resetActiveData();
    });
}

/**
 * Utility to get wallet balances
 */
function updateBalances(callback)
{
    bitfinex.getUpdatedBalances(function (err, balances)
    {
        if (!err && balances)
        {
            data.balanceBTC = balances.balanceBTC;
            data.balanceUSD = balances.balanceUSD;
        }
        if (callback) callback();
    });
}

/**
 * Every 60 seconds log in drive what the trader is thinking
 * for debugging purposes for now
 */
function logStuff()
{
    setInterval(function ()
    {
        let logData = Object.assign(
        {}, data, trader.activeData);

        logData.average = trader.currentAverage;
        logData.currentSupportZone = trader.highestSupportZone;
        logData.currentResistanceZone = trader.lowestResistanceZone;

        sheet.recordTraderData(logData).catch(console.log);
    }, 10000);
}