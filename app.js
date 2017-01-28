/* Dependencies */
var BitfinexWS = require('bitfinex-api-node');
var Sheet = require('./lib/sheet');
var Trader = require('./lib/trader');
var Boot = require('./lib/boot');
var moment = require('moment');


/**
 * Instanciate sheets for recording & bitfinex interfaces
 */
var boot = new Boot();
var sheet = new Sheet(
    process.env.DRIVE_SHEET,
    process.env.DRIVE_CREDS
);
var bws = new BitfinexWS(process.env.BIT_WS_KEY, process.env.BIT_WS_SECRET, 2).ws;
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
    lastSell: null,
    loggedOnce: false
};


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
        // bws.auth();
    });
});
bws.on('trade', function (pair, trade)
{
    trader.inboundTrade(trade);
    checkBuySell(trade.price);
    logCurrentUpdates();
});
bws.on('os', function (data)
{
    if (!data || !data.length) return;

    var order = {
        id: data[0],
        timestamp: data[4],
        side: data[16] > 0 ? 'buy' : 'sell',
        remaining_amount: data[6],
        original_amount: data[7],
        status: data[13], //  ACTIVE, EXECUTED, PARTIALLY FILLED, CANCELED
        price: data[16],
    };

    if (order.side === 'buy') data.lastBuy = order;
    if (order.side === 'sell') data.lastSell = order;

    console.log("order");
    console.log(order);
});
bws.on('error', console.error);


/**
 * Check the trader to find out if we should buy or sell
 */
function checkBuySell(currentTicker)
{
    if (data.balanceBTC > 0)
    {
        if (data.lastBuy && data.lastBuy.is_live) return;
        if (!trader.timeToSell(currentTicker, data.lastBuy.price)) return;

        trader.highestSupportZone = 0;

        data.balanceUSD = (data.balanceBTC * currentTicker) * (1 - fee);
        data.balanceBTC = 0;

        sheet.recordMyTrade(
        {
            time: moment().format('MM/DD HH:mm:ss'),
            ticker: currentTicker,
            type: 'sell',
            amountUSD: data.balanceUSD,
            amountBTC: data.balanceBTC
        }).catch(function (err)
        {
            console.log("Could not record sell trade");
            console.log(err);
        });
    }
    else if (data.balanceUSD > 0)
    {
        if (data.lastSell && data.lastSell.is_live) return;
        if (!trader.timeToBuy(currentTicker)) return;

        data.balanceBTC = (data.balanceUSD / currentTicker) * (1 - fee);
        data.balanceUSD = 0;

        sheet.recordMyTrade(
        {
            time: moment().format('MM/DD HH:mm:ss'),
            ticker: currentTicker,
            type: 'buy',
            amountUSD: data.balanceUSD,
            amountBTC: data.balanceBTC
        }).catch(function (err)
        {
            console.log("Could not record buy trade");
            console.log(err);
        });
    }
}

/**
 * Every 120 seconds log what the trader is thinking
 * for debugging purposes for now
 */
var lastResistanceZone = 0;
var lastSupportZone = 0;

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
        currentData.resistanceZone = trader.lowestResistanceZone(data.lastBuy.price);
    }

    if (data.loggedOnce &&
        (currentData.resistanceZone === lastResistanceZone &&
            currentData.supportZone === lastSupportZone)) return;

    data.loggedOnce = true;

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
