var btfnxPrice = require('./utilities').btfnxPrice;

/**
 * Average responsible for keeping track of current average price,
 * calculated using provided time resolution in ms
 */
module.exports = function (timeResolution)
{
    var currentTrades = [];

    var self = this;
    self.updatedAverage = function(trade)
    {
        removeOldTrades();

        if (trade) currentTrades.push(trade);

        return getWeightedAverage();
    };
    return self;

    /* Private methods */
    function removeOldTrades()
    {   
        var now = Date.now();
        var index = currentTrades.length;
        while (index--)
        {
            var t = currentTrades[index];
            if (t.timestamp + timeResolution < now) continue;
            currentTrades.splice(index, 1);
        }
    }

    function getWeightedAverage()
    {
        var totalVolume = 0;
        var sum = 0;
        var index = currentTrades.length;
        while (index--)
        {
            var t = currentTrades[index];
            sum += parseFloat(t.price) * parseFloat(t.amount);
            totalVolume += parseFloat(t.amount);
        }

        return btfnxPrice(sum / totalVolume);
    }
};
