/* Dependencies */
var BitfinexWS = require('bitfinex-api-node');
var moment = require('moment');

var Sheet = require('./lib/sheet');
var Trader = require('./lib/trader');
var Boot = require('./lib/boot');
var Order = require('./lib/order');


/**
 * Instanciate sheets for recording & bitfinex interfaces
 */
var boot = new Boot();
var sheet = new Sheet(
    process.env.DRIVE_SHEET,
    process.env.DRIVE_CREDS
);
var bws = new BitfinexWS(process.env.BIT_WS_KEY, process.env.BIT_WS_SECRET).ws;
var rest = new BitfinexWS(process.env.BIT_REST_KEY, process.env.BIT_REST_SECRET).rest;


/**
 * Instanciate Trader Mastermind
 */
var risks = {
    max: parseFloat(process.env.MAX_RISK),
    min: parseFloat(process.env.MIN_RISK)
};
var fees = {
    maker: 0.001,
    taker: 0.002
};
var trader = new Trader(risks, fees);


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
var updatingBalances = false;
var makingOrder = false;


/**
 * Bitfinex socket listeners
 */
bws.on('open', function ()
{
    boot.init(rest, sheet, function (accountData, traderData, feesData)
    {
        if (accountData) data = accountData;
        if (feesData) fees = feesData;
        if (traderData && traderData.highestSupportZone > 0)
        {
            try
            {
                var sz = parseFloat(traderData.highestSupportZone);
                if (!isNaN(sz) && sz > 0) trader.highestSupportZone = sz;
            }
            catch (e)
            {}
        }

        bws.subscribeTrades('BTCUSD');
        bws.auth();
    });
});
bws.on('trade', function (pair, trade)
{
    var tradePrice = parseFloat(trade.price);
    trader.inboundTrade(tradePrice);
    checkShouldBuy(tradePrice);
    logCurrentUpdates();
});
bws.on('ts', function (trade)
{
    if (!trade || !trade.length || updatingBalances) return;

    var order = new Order.fromSocket(trade);

    if (data.lastBuy && order.id === data.lastBuy.id)
    {
        if (order.status !== 'EXECUTED') return;
        if (data.lastBuy.status === 'ACTIVE')
        {
            data.lastBuy = order;
            logOrder(order);
        }
    }
    else if (data.lastSell && order.id === data.lastSell.id)
    {
        if (order.status !== 'EXECUTED') return;
        if (data.lastSell.status === 'ACTIVE')
        {
            data.lastSell = order;
            logOrder(order);
        }
    }
    else return;

    if (data.lastBuy && data.lastBuy.status === 'EXECUTED' && data.balanceBTC > 0)
    {
        updateBalances(function ()
        {
            checkShouldBuy(trader.resistanceZone(data.lastBuy.price));
        });
    }
});
bws.on('error', console.error);


/**
 * Check the trader to find out if we should buy or sell
 */
function checkShouldBuy(currentTicker)
{
    // If there i already an active order, exit
    if (data.lastBuy && data.lastBuy.status === 'ACTIVE') return;
    if (data.lastSell && data.lastSell.status === 'ACTIVE') return;

    // If you don't have any USD in wallet, exit
    if (data.balanceUSD === 0) return;

    // If you don't have enough USD to meet the min order amount on bitfinex, exit
    if (data.balanceUSD < (minTradeBTC * currentTicker)) return;

    // If it's not the time to buy according to the trader, exit
    if (!trader.timeToBuy(currentTicker)) return;

    // If you're already currently making an order, exit
    // basically a thread lock
    if (makingOrder) return

    makingOrder = true;
    var newOrder = trader.buyOrder(currentTicker, data.balanceUSD);
    rest.new_order(
        newOrder.symbol,
        newOrder.amount,
        newOrder.price,
        newOrder.exchange,
        newOrder.side,
        newOrder.type,
        function (err, res)
        {
            makingOrder = false;
            if (err)
            {
                console.log("Could not place order");
                return console.log(err);
            }

            // Set all balances to 0 since the current order is active
            data.balanceBTC = 0;
            data.balanceUSD = 0;

            // Log to active order to google sheets
            logOrder(new Order.fromRestA(res));
        });
}

/**
 * Utility to log what the trader is thinking
 * for debugging purposes for now
 */
var lastResistanceZone = -1;
var lastSupportZone = -1;

function logCurrentUpdates()
{
    var currentData = JSON.parse(JSON.stringify(data));

    currentData.supportZone = 0;
    if (trader.highestSupportZone)
    {
        var sz = parseFloat(trader.highestSupportZone);
        if (!isNaN(sz) && sz > 0) currentData.supportZone = sz;
    }

    currentData.resistanceZone = 0;
    if (data.lastBuy)
    {
        currentData.resistanceZone = trader.resistanceZone(data.lastBuy.price);
    }

    if (currentData.resistanceZone === lastResistanceZone &&
        currentData.supportZone === lastSupportZone) return;

    delete currentData.lastBuy;
    delete currentData.lastSell;

    lastResistanceZone = currentData.resistanceZone;
    lastSupportZone = currentData.supportZone;

    currentData.time = moment().format('MM/DD HH:mm:ss');

    sheet.recordTraderData(currentData).catch(function (err)
    {
        console.log("Could not record trader data");
        console.log(err);
    });
}

/**
 * Utility to log an order/trade to google sheets
 */
function logOrder(order)
{
    var prettyOrder = order.sheetsFormat();
    sheet.recordMyTrade(prettyOrder).catch(function (err)
    {
        console.log("Could not record order to drive sheets");
        console.log(err);
    });
}

/**
 * Utility to get wallet balances
 */
function updateBalances(callback)
{
    updatingBalances = true;
    rest.wallet_balances(function (err, res)
    {
        if (err || !res || !res.length)
        {
            updatingBalances = false;
            return callback();
        }

        var btcBalance = res.find(function (b)
        {
            return b.currency === "btc";
        });
        var usdBalance = res.find(function (b)
        {
            return b.currency === "usd";
        });
        try
        {
            if (btcBalance) data.balanceBTC = parseFloat(btcBalance.available);
            if (usdBalance) data.balanceUSD = parseFloat(usdBalance.available);
        }
        catch (e)
        {
            console.log("Error parsing balances");
            console.log(e);
        }

        updatingBalances = false;
        return callback();
    });
}
