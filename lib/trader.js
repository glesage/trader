/**
 * Trader responsible for financial calculations:
 * - calculating support & resistance lines
 * - figuring out when to buy or sell
 */
module.exports = function (fees)
{
    var symbol = 'btcusd';
    var exchange = 'bitfinex';
    var type = 'exchange limit';
    var risk = parseFloat(process.env.RISK);

    var self = this;
    self.buyOrder = buyOrder;
    self.sellOrder = sellOrder;
    self.supportZone = supportZone;
    self.resistanceZone = resistanceZone;
    self.currentResistanceZone = null;
    return self;

    /* Public */
    function buyOrder(ticker, balanceUSD)
    {
        // Bitfinex goes up to 8 decimals maximum for trades
        var price = String(supportZone(ticker).toFixed(8));

        // Bitfinex goes up to 8 decimals maximum for trades
        var amount = String((balanceUSD / ticker).toFixed(8));

        // Return that data to the app
        return {
            symbol: symbol,
            amount: amount,
            price: price,
            exchange: exchange,
            side: 'buy',
            type: type
        };
    }

    function sellOrder(ticker, balanceBTC)
    {
        // Bitfinex goes up to 8 decimals maximum for trades
        var amount = String(balanceBTC.toFixed(8));

        // Return that data to the app
        return {
            symbol: symbol,
            amount: amount,
            price: String(ticker),
            exchange: exchange,
            side: 'sell',
            type: type
        };
    }

    function supportZone(price)
    {
        // The ticker amount below the current price required for a buy
        // Use half the risk since we want to sell at another half higher
        return price * (1 - (risk / 2));
    }

    function resistanceZone(price)
    {
        // The ticker amount above the current price required for a sell
        return price * (1 + (risk + fees.maker));
    }
};
