var toFixed = require('./utilities').fixedDecimals;
var btfnxPrice = require('./utilities').btfnxPrice;

/**
 * Trader responsible for financial calculations:
 * - calculating support & resistance lines
 * - figuring out when to buy or sell
 */
module.exports = function (fees, placeOrder, replaceOrder)
{
    var symbol = 'btcusd';
    var exchange = 'bitfinex';
    var type = 'exchange limit';
    var risk = parseFloat(process.env.RISK);
    var minTradeBTC = 0.01;

    var self = this;
    self.gotCurrentTicker = gotCurrentTicker;
    return self;

    /* Public */
    function gotCurrentTicker(ticker, data)
    {
        // If there is no active buy order, exit
        if (data.activeBuy && data.activeBuy.id)
        {
            // If the new ticker is lower than the last buy time, exit
            var newPrice = supportZone(ticker);
            if (newPrice <= data.activeBuy.price) return;

            var oldBalance = (data.activeBuy.price * data.activeBuy.amount).toFixed(8);
            replaceOrder(data.activeBuy.id, buyOrder(ticker, oldBalance));
        }
        else if (!data.activeSell && data.balanceBTC > 0)
        {
            // If you don't have enough BTC to meet the min order amount on bitfinex, exit
            if (data.balanceBTC > minTradeBTC) return;

            var sellPrice = resistanceZone(data.lastBuy.price);
            placeOrder(sellOrder(sellPrice, data.balanceBTC));
        }
        else if (!data.activeSell && data.balanceUSD > 0)
        {
            // If you don't have enough USD to meet the min order amount on bitfinex, exit
            if (data.balanceUSD < (minTradeBTC * ticker)) return;

            placeOrder(buyOrder(ticker, data.balanceUSD));
        }
    }

    function buyOrder(ticker, balanceUSD)
    {
        // Bitfinex goes up to 8 decimals maximum for trades
        var price = supportZone(ticker);

        // Bitfinex goes up to 8 decimals maximum for trades
        var amount = toFixed(balanceUSD / price, 8);

        // Return that data to the app
        return {
            symbol: symbol,
            amount: String(amount),
            price: String(price),
            exchange: exchange,
            side: 'buy',
            type: type
        };
    }

    function sellOrder(price, balanceBTC)
    {
        // Bitfinex goes up to 8 decimals maximum for trades
        var amount = toFixed(balanceBTC, 8);

        // Make sure to round down & trim to correct number of decimals
        price = btfnxPrice(ticker);

        // Return that data to the app
        return {
            symbol: symbol,
            amount: String(amount),
            price: String(price),
            exchange: exchange,
            side: 'sell',
            type: type
        };
    }

    function supportZone(price)
    {
        // The ticker amount below the current price required for a buy
        // Use half the risk since we want to sell at another half higher
        return btfnxPrice(price * (1 - (risk / 2) - fees.maker));
    }

    function resistanceZone(price)
    {
        // The ticker amount above the current price required for a sell
        return btfnxPrice(price * (1 + (risk + fees.maker)));
    }
};
