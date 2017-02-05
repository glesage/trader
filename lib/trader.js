var toFixed = require('./utilities').fixedDecimals;
var btfnxPrice = require('./utilities').btfnxPrice;

/**
 * Trader responsible for financial calculations:
 * - calculating support & resistance lines
 * - figuring out when to buy or sell
 */
module.exports = function (fees, placeOrder)
{
    var symbol = 'btcusd';
    var exchange = 'bitfinex';
    var type = 'exchange limit';

    var risk = parseFloat(process.env.RISK);
    var maxWait = parseInt(process.env.MAX_WAIT);
    var minTradeBTC = 0.01;

    var self = this;
    self.gotCurrentTicker = gotCurrentTicker;
    self.activeData = {
        buyPrice: null,
        buyTime: null,
        sellPrice: null,
        sellTime: null
    };
    self.lastTicker = null;
    self.highestSupportZone = null;
    self.lowestResistanceZone = null;
    return self;

    /* Public methods */
    function gotCurrentTicker(ticker, data)
    {
        self.lastTicker = ticker;


        // If there is already an active order, exit
        if (data.activeBuy || data.activeSell) return;


        // If USD balance is above Bitfinex min order check if a buy would be appropriate
        if (data.balanceUSD > 0 && data.balanceUSD > (minTradeBTC * ticker))
        {
            var newSupportZone = supportZone(ticker);

            // If there is no pre-existing support zone, set it and exit
            if (!self.highestSupportZone)
            {
                self.highestSupportZone = newSupportZone;
                return;
            }

            // If the new support zone is higher than the previous one, set it
            if (comparePrices(newSupportZone, self.highestSupportZone) === 1)
            {
                self.highestSupportZone = newSupportZone;
                return;
            }

            // If the ticker is above the support zone, exit
            if (comparePrices(ticker, self.highestSupportZone) > -1) return;

            // If this is the first sign of a buy, just record this moment
            if (!self.activeData.buyPrice || !self.activeData.buyTime) return possibleBuy(ticker);

            // If the ticker has dropped since last time, just record this moment
            if (comparePrices(ticker, self.activeData.buyPrice) === -1) return possibleBuy(ticker);

            // If it's been long enough, just buy
            if (self.activeData.buyTime + maxWait > Date.now())
            {
                return placeOrder(buyOrder(btfnxPrice(ticker), data.balanceUSD));
            }

            // If the ticker has risen enough to trigger the buy, also buy
            if (ticker < highestPriceForBuy(self.activeData.buyPrice))
            {
                return placeOrder(buyOrder(btfnxPrice(ticker), data.balanceUSD));
            }
        }

        // If BTC balance is above Bitfinex minimum check if a sell would be appropriate
        else if (data.balanceBTC > 0 && data.balanceBTC > minTradeBTC)
        {
            // If there is no pre-existing support zone, set it and exit
            if (!self.lowestResistanceZone)
            {
                self.lowestResistanceZone = lowestSellPrice(data.lastBuy.price);
            }

            // If the ticker is below the minimum sell amount to break even, exit
            if (comparePrices(ticker, self.lowestResistanceZone) < 1) return;

            // If this is the first sign of a sell, just record this moment
            if (!self.activeData.sellPrice || !self.activeData.sellTime) return possibleSell(ticker);

            // If the ticker has risen since last time, just record this moment
            if (comparePrices(ticker, self.activeData.sellPrice) === 1) return possibleSell(ticker);

            // If it's been long enough, just sell
            if (self.activeData.sellTime + maxWait > Date.now())
            {
                return placeOrder(sellOrder(btfnxPrice(ticker), data.balanceBTC));
            }

            // If the ticker has dropped enough to trigger the sell, also sell
            if (ticker < lowestPriceForSell(self.activeData.sellPrice))
            {
                return placeOrder(sellOrder(btfnxPrice(ticker), data.balanceBTC));
            }
        }
    }

    function buyOrder(price, balanceUSD)
    {
        resetActiveData();

        // Make sure to round down & trim to correct number of decimals
        price = btfnxPrice(price);

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
        // Make sure to round down & trim to correct number of decimals
        price = btfnxPrice(price);

        // Bitfinex goes up to 8 decimals maximum for trades
        var amount = toFixed(balanceBTC, 8);

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

    /* Private methods */
    function possibleSell(price)
    {
        self.activeData.sellPrice = price;
        self.activeData.sellTime = Date.now();
    }

    function possibleBuy(price)
    {
        self.activeData.buyPrice = price;
        self.activeData.buyTime = Date.now();
    }

    // The amount below the current price required for a buy
    function supportZone(price)
    {
        return parseFloat(price) * (1 - fees.maker);
    }

    // The amount above the current price required for a sell
    function lowestSellPrice(price)
    {
        return parseFloat(price) * (1 + fees.maker);
    }

    // The price below the current sell position that would indicate
    // that the ticker will keep dropping
    function lowestPriceForSell(price)
    {
        var possiblePrice = parseFloat(price) * (1 - risk);

        // Just make sure the new price is actually lower even when rounded to the right
        // number of decimals
        if (btfnxPrice(possiblePrice) < btfnxPrice(price)) return possiblePrice;

        // If it is not, then just subtract the smallest possible unit to the price
        return price - 0.1;
    }

    // The price above the current buy position that would indicate
    // that the ticker will keep rising
    function highestPriceForBuy(price)
    {
        var possiblePrice = parseFloat(price) * (1 + risk);

        // Just make sure the new price is actually higher even when rounded to the right
        // number of decimals
        if (btfnxPrice(possiblePrice) > btfnxPrice(price)) return possiblePrice;

        // If it is not, then just add the smallest possible unit to the price
        return price + 0.1;
    }

    // Utility to reset the active data when a trade is executed
    function resetActiveData()
    {
        self.activeData = {};
        self.highestSupportZone = null;
    }

    function comparePrices(p1, p2)
    {
        p1 = btfnxPrice(p1);
        p2 = btfnxPrice(p2);
        if (p1 > p2) return 1;
        if (p1 < p2) return -1;
        return 0;
    }
};
