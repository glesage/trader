/* Dependencies */
var Sheet = require('./lib/sheet');
var Trader = require('./lib/trader');
var Boot = require('./lib/boot');
var Order = require('./lib/order');
var Logger = require('./lib/logger');
var Bitfinex = require('./lib/bitfinex');

/**
 * Instanciate helpers
 */
var trader;
var boot = new Boot();
var sheet = new Sheet();
var logger = new Logger(trader, sheet);
var bitfinex = new Bitfinex(gotTradePrices, gotOrderUpdate);


/**
 * Main datastructure recording state
 */
var data = {
    balanceUSD: 0,
    balanceBTC: 0,
    lastBuy: null,
    lastSell: null,
    activeBuy: null,
    activeSell: null
};
var makingOrder = false;


boot.init(bitfinex, function (accountData, feesData)
{
    data = accountData;
    trader = new Trader(feesData, placeOrder, replaceOrder);
    bitfinex.start();
});


function gotTradePrices(tradePrice)
{
    trader.gotCurrentTicker(tradePrice, data);
}

function gotOrderUpdate(order)
{
    updateBalances(function ()
    {
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
    bitfinex.placeOrder(order, madeOrderCallback);
}

function replaceOrder(orderId, order)
{
    if (makingOrder || !orderId || !order) return;
    makingOrder = true;
    bitfinex.replaceOrder(orderId, order, madeOrderCallback);
}

/**
 * Callback to handle new order creation
 */
function madeOrderCallback(err, res)
{
    makingOrder = false;

    if (err || !res)
    {
        console.log("Could not perform trade or update");
        console.log(err);
        return;
    }

    var order = res;
    if (!(res instanceof Order)) order = new Order.fromRestA(order);

    // Record to active order
    if (order.type === 'buy') data.activeBuy = order;
    else if (order.type === 'sell') data.activeSell = order;

    // Log to active order to google sheets
    logger.orderUpdate(order);
}

/**
 * Utility to get wallet balances
 */
function updateBalances(callback)
{
    bitfinex.getUpdatedBalances(function (balances)
    {
        if (balances)
        {
            data.balanceBTC = balances.balanceBTC;
            data.balanceUSD = balances.balanceUSD;
        }
        if (callback) callback();
    });
}
