/* Dependencies */
var Sheet = require('./lib/sheet');
var Trader = require('./lib/trader');
var Boot = require('./lib/boot');
var Order = require('./lib/order');
var Logger = require('./lib/logger');
var Bitfinex = require('./lib/bitfinex');
var btfnxPrice = require('./lib/utilities').btfnxPrice;

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
    lastSell: null,
    activeBuy: null,
    activeSell: null
};
var minTradeBTC = 0.01;
var makingOrder = false;

function gotTradePrices(tradePrice)
{
    checkShouldUpdate(tradePrice);
    checkShouldBuy(tradePrice);
    checkShouldSell();
}

function gotOrderUpdate(order)
{
    if (order.status === 'EXECUTED')
    {
        // If the order was our active buy that has been executed, record that
        if (data.activeBuy && order.id === data.activeBuy.id)
        {
            data.lastBuy = order;
            data.activeBuy = null;
            logger.orderUpdate(order);
        }
        // If the order was our active sell that has been executed, record that
        else if (data.activeSell && order.id === data.activeSell.id)
        {
            data.lastSell = order;
            data.activeSell = null;
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

    // If you don't have any BTC in wallet, exit
    if (data.balanceBTC === 0) return;

    // If you don't have enough BTC to meet the min order amount on bitfinex, exit
    if (data.balanceBTC < minTradeBTC) return;

    // If you're already currently making an order, exit
    // basically a thread lock
    if (makingOrder) return;

    makingOrder = true;

    var sellPrice = trader.currentResistanceZone;
    if (!sellPrice || sellPrice < 0)
    {
        trader.currentResistanceZone = trader.resistanceZone(data.lastBuy.price);
        sellPrice = trader.currentResistanceZone;
    }
    var orderData = trader.sellOrder(sellPrice, data.balanceBTC);
    bitfinex.placeOrder(orderData, madeOrderCallback);
}

function checkShouldBuy(currentTicker)
{
    // If there is already an active order, exit
    if (hasActiveOrder()) return;

    // If you don't have any USD in wallet, exit
    if (data.balanceUSD === 0) return;

    // If you don't have enough USD to meet the min order amount on bitfinex, exit
    var currentPrice = btfnxPrice(currentTicker);
    if (data.balanceUSD < (minTradeBTC * currentPrice)) return;

    // If you're already currently making an order, exit
    // basically a thread lock
    if (makingOrder) return;

    makingOrder = true;
    var orderData = trader.buyOrder(currentPrice, data.balanceUSD);
    trader.currentResistanceZone = trader.resistanceZone(orderData.price);
    bitfinex.placeOrder(orderData, madeOrderCallback);
}

function checkShouldUpdate(currentTicker)
{
    // If there is no active buy order, exit
    if (!data.activeBuy || !data.activeBuy.id) return;

    // If you're already currently making an order, exit
    // basically a thread lock
    if (makingOrder) return;

    // If the new ticker is lower than the last buy time, exit
    var newPrice = trader.supportZone(currentTicker);
    if (newPrice <= data.activeBuy.price) return;

    makingOrder = true;
    var oldBalance = (data.activeBuy.price * data.activeBuy.amount).toFixed(8);

    var orderData = trader.buyOrder(currentTicker, oldBalance);
    var newBalance = (orderData.price * orderData.amount).toFixed(8);

    if (newBalance > oldBalance) return;

    trader.currentResistanceZone = trader.resistanceZone(currentTicker);
    bitfinex.replaceOrder(data.activeBuy.id, orderData, madeOrderCallback);
}

/**
 * Utility to check whether there is an active order
 */
function hasActiveOrder()
{
    return data.activeBuy && data.activeSell;
}

/**
 * Callback to handle new order creation
 */
function madeOrderCallback(err, res)
{
    if (err || !res)
    {
        reset();
        console.log("Could not perform trade or update");
        return console.log(err);
    }

    makingOrder = false;

    var order = res;
    if (!(res instanceof Order)) order = new Order.fromRestA(order);

    // Record to active order
    if (order.type === 'buy') data.activeBuy = order;
    if (order.type === 'sell') data.activeSell = order;

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


/**
 * Utility to reset data when there is a failure
 */
function reset()
{
    boot.init(bitfinex, function (accountData, feesData)
    {
        if (accountData) data = accountData;
        if (feesData) fees = feesData;

        if (!bitfinex.started) bitfinex.start();

        makingOrder = false;
    });
}

reset();
