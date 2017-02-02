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
var fees = {
    maker: 0.001,
    taker: 0.002
};
var boot = new Boot();
var sheet = new Sheet();
var trader = new Trader(fees);
var logger = new Logger(trader, sheet);
var bitfinex = new Bitfinex(gotTradePrices, gotOrderUpdate);


/**
 * Main datastructure recording state
 */
var data = {
    balanceUSD: 0,
    balanceBTC: 0,
    lastBuy: null,
    lastSell: null
};
var minTradeBTC = 0.01;
var makingOrder = false;

boot.init(bitfinex, function (accountData, feesData)
{
    if (accountData) data = accountData;
    if (feesData) fees = feesData;

    logActiveOrders();

    bitfinex.start();
});

function gotTradePrices(tradePrice)
{
    checkShouldUpdate(tradePrice);
    checkShouldBuy(tradePrice);
    checkShouldSell();
}

function gotOrderUpdate(order)
{
    if (data.lastBuy && order.id === data.lastBuy.id)
    {
        if (order.status !== 'EXECUTED') return;
        if (data.lastBuy.status === 'ACTIVE')
        {
            data.lastBuy = order;
            logger.orderUpdate(order);
        }
    }
    else if (data.lastSell && order.id === data.lastSell.id)
    {
        if (order.status !== 'EXECUTED') return;
        if (data.lastSell.status === 'ACTIVE')
        {
            data.lastSell = order;
            logger.orderUpdate(order);
        }
    }
}


/**
 * Check the trader to find out if we should buy or sell
 */
function checkShouldSell()
{
    // If there is already an active order, exit
    if (hasActiveOrder()) return;

    updateBalances(function ()
    {
        // If you don't have any BTC in wallet, exit
        if (data.balanceBTC === 0) return;

        // If you don't have enough BTC to meet the min order amount on bitfinex, exit
        if (data.balanceBTC < minTradeBTC) return;

        // If you're already currently making an order, exit
        // basically a thread lock
        if (makingOrder) return;

        makingOrder = true;

        var sellPrice = trader.currentResistanceZone;
        var orderData = trader.sellOrder(sellPrice, data.balanceBTC);
        bitfinex.placeOrder(orderData, madeOrderCallback);
    });
}

function checkShouldBuy(currentTicker)
{
    // If there is already an active order, exit
    if (hasActiveOrder()) return;

    // If you don't have any USD in wallet, exit
    if (data.balanceUSD === 0) return;

    // If you don't have enough USD to meet the min order amount on bitfinex, exit
    if (data.balanceUSD < (minTradeBTC * currentTicker)) return;

    // If you're already currently making an order, exit
    // basically a thread lock
    if (makingOrder) return;

    makingOrder = true;
    var orderData = trader.buyOrder(currentTicker, data.balanceUSD);
    trader.currentResistanceZone = trader.resistanceZone(orderData.price);
    bitfinex.placeOrder(orderData, madeOrderCallback);
}

function checkShouldUpdate(currentTicker)
{
    // If there is no active buy order, exit
    if (!data.lastBuy || data.lastBuy.status !== 'ACTIVE') return;

    // If the new ticker is lower than the last buy time, exit
    var newPrice = trader.supportZone(currentTicker).toFixed(2);
    if (newPrice < data.lastBuy.price) return;

    // If you're already currently making an order, exit
    // basically a thread lock
    if (makingOrder) return;

    makingOrder = true;
    trader.currentResistanceZone = trader.resistanceZone(newPrice);
    bitfinex.updateOrder(data.lastBuy, newPrice, madeOrderCallback);
}

/**
 * Utility to check whether there is an active order
 */
function hasActiveOrder()
{
    // If there i already an active order, exit
    if (data.lastBuy && data.lastBuy.status === 'ACTIVE') return true;
    if (data.lastSell && data.lastSell.status === 'ACTIVE') return true;

    return false;
}

/**
 * Utility to log active orders
 */
function logActiveOrders()
{
    if (!hasActiveOrder()) return;

    if (data.lastBuy && data.lastBuy.status === 'ACTIVE')
    {
        logger.orderUpdate(data.lastBuy);
    }
    else if (data.lastSell && data.lastSell.status === 'ACTIVE')
    {
        logger.orderUpdate(data.lastSell);
    }
}

/**
 * Callback to handle new order creation
 */
function madeOrderCallback(err, res)
{
    makingOrder = false;
    if (err || !res)
    {
        console.log("Could not place order");
        return console.log(err);
    }

    // Set all balances to 0 since the current order is active
    data.balanceBTC = 0;
    data.balanceUSD = 0;

    var order = new Order.fromRestA(res);

    // Record to active order
    if (order.type === 'buy') data.lastBuy = order;
    if (order.type === 'sell') data.lastSell = order;

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
        callback();
    });
}
