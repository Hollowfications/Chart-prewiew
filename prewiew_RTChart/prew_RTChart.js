'use strict';
function prew_realTimeChart(){
    var datum, initialData, data,
        maxSeconds = 300, pixelsPerSecond = 10,
        svgWidth = 700, svgHeight = 300,
        margin = { top: 20, bottom: 20, left: 35, right: 20},
        dimension = {xAxis: 10, yAxis: 5, xTitle: 10, yTitle: 10, navChart: 40},
        maxY = 1, minY = -1,
        drawXAxis = true, drawNavChart = true,
        border,
        selection;
    // create the chart
    var chart = function(s) {
        selection = s;
        if (selection == undefined) {
            console.error("selection is undefined");
            return;
        }

        // compute component dimensions
        var xAxisDim = !drawXAxis ? 0 : dimension.xAxis;
        var navChartDim = !drawNavChart ? 0 : dimension.navChart;

        // compute chart dimension and offset
        var marginTop = margin.top; //+ chartTitleDim;
        var height = svgHeight - marginTop - margin.bottom  - xAxisDim - navChartDim + 30;
        var width = svgWidth - margin.left - margin.right;
        var widthNav = width;

        // append the svg
        var svg = selection.append("svg")
            .attr("width", svgWidth)
            .attr("height", svgHeight)
            .style("border", function(d) {
                if (border) return "1px solid lightgray";
                else return null;
            });

        // create main group and translate
        var main = svg.append("g")
            .attr("transform", "translate (" + margin.left + "," + marginTop + ")");


        // define clip-path
        main.append("defs").append("clipPath")
            .append("rect")
            .attr("x", 0)
            .attr("y", 0)
            .attr("width", width)
            .attr("height", height);

        // create chart background
        main.append("rect")
            .attr("x", 0)
            .attr("y", 0)
            .attr("width", width)
            .attr("height", height)
            .style("fill", "#f5f5f5");

        // note that two groups are created here, the latter assigned to barG;
        // the former will contain a clip path to constrain objects to the chart area;
        // no equivalent clip path is created for the nav chart as the data itself
        // is clipped to the full time domain
        var barG = main.append("g")
            .attr("class", "barGroup")
            .attr("transform", "translate(0, 0)")
            .append("g");

        // add group for x axis
        var xAxisG = main.append("g")
            .attr("class", "x axis")
            .attr("transform", "translate(0," + height + ")");

        // add group for y axis
        var yAxisG = main.append("g")
            .attr("class", "y axis");


        // define main chart scales
        var x = d3.time.scale().range([0, width]);
        var y = d3.scale.linear().domain([minY, maxY]).range([height, 0]);

        // define main chart axis
        var xAxis = d3.svg.axis().orient("bottom");
        var yAxis = d3.svg.axis().orient("left");


        // define nav scales
        var xNav = d3.time.scale().range([0, widthNav]);

        // compute initial time domains...
        var ts = new Date().getTime();

        // first, the full time domain
        var endTime = new Date(ts);
        var startTime = new Date(endTime.getTime() - maxSeconds * 1000);

        // then the viewport time domain (what's visible in the main chart
        // and the viewport in the nav chart)
        var endTimeViewport = new Date(ts);
        var startTimeViewport = new Date(endTime.getTime() - width / pixelsPerSecond * 1000);
        var intervalViewport = endTimeViewport.getTime() - startTimeViewport.getTime();
        var offsetViewport = startTimeViewport.getTime() - startTime.getTime();

        // set the scale domains for main and nav charts
        x.domain([startTimeViewport, endTimeViewport]);
        xNav.domain([startTime, endTime]);

        // update axis with modified scale
        xAxis.scale(x)(xAxisG);
        yAxis.scale(y)(yAxisG);



        // create brush (movable, changeable rectangle that determines
        // the time domain of main chart)
        var viewport = d3.svg.brush()
            .x(xNav)
            .extent([startTimeViewport, endTimeViewport])
            .on("brush", function () {
                // get the current time extent of viewport
                var extent = viewport.extent();

                startTimeViewport = extent[0];
                endTimeViewport = extent[1];
                intervalViewport = endTimeViewport.getTime() - startTimeViewport.getTime();
                offsetViewport = startTimeViewport.getTime() - startTime.getTime();

                // handle invisible viewport
                if (intervalViewport == 0) {
                    intervalViewport = maxSeconds * 1000;
                    offsetViewport = 0;
                }

                // update the x domain of the main chart
                x.domain(viewport.empty() ? xNav.domain() : extent);

                // update the x axis of the main chart
                 xAxis.scale(x)(xAxisG);

                // update display
                refresh();
            });


        // initial invocation
        data = initialData || [];

        // update display
        refresh();


        // function to refresh the viz upon changes of the time domain
        // (which happens constantly), or after arrival of new data,
        // or at init
        function refresh() {

            // process data to remove too late or too early data items
            // (the latter could occur if the chart is stopped, while data
            // is being pumped in)
            data = data.filter(function(d) {
                if (d.time.getTime() > startTime.getTime() &&
                    d.time.getTime() < endTime.getTime())
                    return true;
            });

            // here we bind the new data to the main chart
            // note: no key function is used here; therefore the data binding is
            // by index, which effectively means that available DOM elements
            // are associated with each item in the available data array, from
            // first to last index; if the new data array contains fewer elements
            // than the existing DOM elements, the LAST DOM elements are removed;
            // basically, for each step, the data items "walks" leftward (each data
            // item occupying the next DOM element to the left);
            // This data binding is very different from one that is done with a key
            // function; in such a case, a data item stays "resident" in the DOM
            // element, and such DOM element (with data) would be moved left, until
            // the x position is to the left of the chart, where the item would be
            // exited
       /*var updateSel = barG.selectAll(".bar")
           .data(data)*/

            barG.selectAll("path").remove();


            var dLine = d3.svg.line()
                .x(function (d) { return x(d.time); })
                .y(function (d) { return y(d.value); });

            var updateSel = barG.append('path')
                .attr('d', dLine(data))
                .attr("stroke", "blue")
                .attr("stroke-width", 2)
                .attr("fill", "none");


        } // end refreshChart function


        // function to keep the chart "moving" through time (right to left)
        setInterval(function() {

            // get current viewport extent
            var extent = viewport.empty() ? xNav.domain() : viewport.extent();
            var interval = extent[1].getTime() - extent[0].getTime();
            var offset = extent[0].getTime() - xNav.domain()[0].getTime();

            // compute new nav extents
            endTime = new Date();
            startTime = new Date(endTime.getTime() - maxSeconds * 1000);

            // compute new viewport extents
            startTimeViewport = new Date(startTime.getTime() + offset);
            endTimeViewport = new Date(startTimeViewport.getTime() + interval);
            viewport.extent([startTimeViewport, endTimeViewport]);

            // update scales
            x.domain([startTimeViewport, endTimeViewport]);
            xNav.domain([startTime, endTime]);

            // update axis
            xAxis.scale(x)(xAxisG);

            // refresh svg
            refresh();

        }, 200);

        // end setInterval function

        return chart;

    } ;// end chart function


    // chart getter/setters

    // array of initial data
    chart.initialData = function(_) {
        if (arguments.length == 0) return initialData;
        initialData = _;
        return chart;
    };

    // new data item (this most recent item will appear
    // on the right side of the chart, and begin moving left)
    chart.datum = function(_) {
        if (arguments.length == 0) return datum;
        datum = _;
        data.push(datum);
        return chart;
    };

    // svg width
    chart.width = function(_) {
        if (arguments.length == 0) return svgWidth;
        svgWidth = _;
        return chart;
    };

    // svg height
    chart.height = function(_) {
        if (arguments.length == 0) return svgHeight;
        svgHeight = _;
        return chart;
    };

    // svg border
    chart.border = function(_) {
        if (arguments.length == 0) return border;
        border = _;
        return chart;
    };

    return chart;

}