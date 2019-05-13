import * as d3 from 'd3';

export default function () {
  //Width and height
  const margin = {
    top: 35,
    right: 35,
    bottom: 25,
    left: 50
  }
  const w = container.offsetWidth
  const h = container.offsetHeight

  const parseTime = d3.timeParse('%Y') //convert strings to dates
  const formatTime = d3.timeFormat('%Y') //date format

  //Function for converting CSV values from strings to Dates and numbers
  const rowConverter = (d, i, cols) => {

    const row = {
      year: parseTime(d.year)
    } //make new date object for each year

    for (let i = 1; i < cols.length; i++) { //loop for each growth type
      row[cols[i]] = +d[cols[i]] //convert from string to int
    }
    return row
  }

  //colors
  const colors = d3.scaleOrdinal(d3.schemeCategory10)

  //for back button toggle
  let viewState = 0

  //bar transition duration
  const barTransition = 750

  //define stacks
  const stack = d3.stack()
  const transitionStack = d3.stack()
  const thisStack = d3.stack()

  //create svg
  const svg = d3.select('#container')
    .append('svg')
    .attr('width', w)
    .attr('height', h)

  let gdpLineDataset, dataset, thisType, thisKeys, thisSeries;

  d3.csv('data/growth_data.csv', rowConverter).then(data => {
    dataset = data

    d3.csv('data/growth_data_lines.csv', rowConverter).then(gdpLineData => {
      gdpLineDataset = gdpLineData

      const keys = dataset.columns.slice(1)
      stack.keys(keys)
        .offset(d3.stackOffsetDiverging)
        .order(d3.stackOrderInsideOut)

      //data, stacked
      const series = stack(dataset)

      drawGdp(dataset, series, keys)
      drawGdpLine(gdpLineDataset)
      drawBackbutton(dataset, series, keys)

      //LEGEND
      const legendVals = ['Personal Consumption', 'Gross private domestic investment', 'Net Trade', 'Government consumption and gross investment']

      drawLegend(legendVals)
    })
  })

  let xScale, yScale;

  function drawGdp(data, series, keys) {

    //scales
    xScale = d3.scaleBand()
      .domain(data.map(d => d.year))
      .range([margin.left, w - margin.right])
      .paddingInner(0.1)
      .paddingOuter(0.75)

    yScale = d3.scaleLinear()
      .domain([d3.min(series, stackMin), d3.max(series, stackMax)])
      .range([h - margin.bottom, margin.top])
      .nice()

    //Define axes
    let xAxis = d3.axisBottom()
      .scale(xScale)
      .tickValues(xScale.domain().filter((d, i) => !(i % 10)))
      .tickFormat(d3.timeFormat('%Y'))
      .tickSize(0)

    //Define right Y axis
    let yAxisR = d3.axisRight()
      .scale(yScale)
      .ticks(8)
      .tickSizeOuter(0)

    //Define left Y axis
    let yAxisL = d3.axisLeft()
      .scale(yScale)
      .ticks(8)
      .tickSizeOuter(0)

    //Define grey y axis lines
    let yAxisGrid = d3.axisLeft()
      .scale(yScale)
      .ticks(8)
      .tickSizeOuter(0)
      .tickSizeInner(-w + margin.left + margin.right)
      .tickFormat('')

    //group data rows
    const bars = svg.selectAll('#originalBars')
      .data(series)
      .enter()
      .append('g')
      .attr('id', 'originalBars')
      .style('fill', (d, i) => colors(i))
      .attr('class', (d, i) => d.key)

    //add rect for each data value
    const rects = bars.selectAll('rect')
      .data(d => d)
      .enter()
      .append('rect')
      .attr('x', (d, i) => xScale(d.data.year))
      .attr('y', d => yScale(d[1]))
      .attr('height', d => yScale(d[0]) - yScale(d[1]))
      .attr('width', xScale.bandwidth)
      .attr('id', 'indivBars')
      .attr('class', function (d, i) {
        return 'bar-' + d3.select(this.parentNode).attr('class')
      })
      .style('cursor', 'pointer')
      .on('mousemove', function (d, i) {
        let tooltipType = d3.select(this.parentNode).attr('class')

        tooltipDiv.transition()
          .style('opacity', .9)

        tooltipDiv.html(`${tooltipType}<br/>${formatTime(d.data.year)}: ${d.data[tooltipType]}%`)
          .style('left', (d3.event.pageX + 5) + 'px')
          .style('top', (d3.event.pageY - 38) + 'px')
      })
      .on('mouseout', d => {
        tooltipDiv.transition()
          .duration(500)
          .style('opacity', 0)
      })

    rects.on('click', function (d, i) {
      thisType = d3.select(this.parentNode).attr('class')

      viewState++
      toggleBackButton()

      d3.csv('data/growth_data_' + thisType + '.csv', rowConverter).then(thisGdpData => {
        const thisDataset = thisGdpData

        //Generate a new data set with all-zero values, 
        //except for this type's data for beginning of transition
        let transitionDataset = []

        for (let i = 0; i < data.length; i++) {
          transitionDataset[i] = {
            year: data[i].year,
            personal_consumption: 0,
            gross_private_domestic_inv: 0,
            net_trade: 0,
            gov_consumption_and_gross_inv: 0,
            [thisType]: data[i][thisType] //Overwrites the appropriate zero value above
          }
        }

        transitionStack.keys(keys)
          .offset(d3.stackOffsetDiverging)
          .order(d3.stackOrderAscending)

        const transitionSeries = transitionStack(transitionDataset)

        //remove gdp line
        d3.select('#line').transition().duration(barTransition / 2).style('opacity', 0)

        //update y scale
        yScale = d3.scaleLinear()
          .domain([d3.min(transitionSeries, stackMin) - 0.5, d3.max(transitionSeries, stackMax) + 0.5])
          .range([h - margin.bottom, margin.top])
          .nice()

        //update y axes
        let yAxisR = d3.axisRight()
          .scale(yScale)
          .ticks(8)
          .tickSizeOuter(0)

        let yAxisL = d3.axisLeft()
          .scale(yScale)
          .ticks(8)
          .tickSizeOuter(0)

        let yAxisGrid = d3.axisLeft()
          .scale(yScale)
          .ticks(8)
          .tickSizeOuter(0)
          .tickSizeInner(-w + margin.left + margin.right)
          .tickFormat('')

        svg.select('.axis.yl')
          .transition().duration(barTransition)
          .call(yAxisL)

        svg.select('.axis.yr')
          .transition().duration(barTransition)
          .call(yAxisR)

        svg.select('.axis.ygrid')
          .transition().duration(barTransition)
          .call(yAxisGrid)

        svg.select('.axis.x')
          .transition().duration(barTransition)
          .select('.domain').attr('transform', `translate(0, ${(yScale(0) - (h - margin.bottom))})`)

        //transition bars
        keys.forEach((key, key_index) => {

          const bars = svg.selectAll('.bar-' + key)
            .data(transitionSeries[key_index])
            .transition().duration(barTransition)
            .attr('y', function (d) {
              return yScale(d[1])
            })
            .attr('height', d => yScale(d[0]) - yScale(d[1]))
            .transition()
            .style('opacity', 0)
        })

        thisKeys = thisDataset.columns.slice(1)
        thisStack.keys(thisKeys)
          .offset(d3.stackOffsetDiverging)
          .order(d3.stackOrderInsideOut)

        thisSeries = thisStack(thisDataset)

        //group data rows
        const bars = svg.selectAll('#bars')
          .data(thisSeries)
          .enter()
          .append('g')
          .attr('id', 'bars')
          .style('fill', (d, i) => colors(i))
          .attr('class', (d, i) => d.key)

        //add rect for each data value
        const rects = bars.selectAll('rect')
          .data(d => d)
          .enter()
          .append('rect')
          .attr('x', (d, i) => xScale(d.data.year))
          .attr('y', d => yScale(d[1]))
          .attr('height', d => yScale(d[0]) - yScale(d[1]))
          .attr('width', xScale.bandwidth)
          .attr('id', 'indivBars')
          .attr('class', function (d, i) {
            return 'thisBar-' + d3.select(this.parentNode).attr('class')
          })
          .on('mousemove', function (d, i) {
            let tooltipType = d3.select(this.parentNode).attr('class')

            tooltipDiv.transition()
              .style('opacity', .9)

            tooltipDiv.html(`${tooltipType}<br/>${formatTime(d.data.year)}: ${d.data[tooltipType]}%`)
              .style('left', (d3.event.pageX + 5) + 'px')
              .style('top', (d3.event.pageY - 38) + 'px')
          })
          .on('mouseout', d => {
            tooltipDiv.transition()
              .duration(500)
              .style('opacity', 0)
          })
          .style('opacity', 0)
          .transition().delay(barTransition)
          .style('opacity', 1)

        //net line for thisType
        drawThisLine(gdpLineDataset)

        //new legend
        d3.selectAll('.legend').classed('hidden', true)
        const legendVals = thisKeys

        let wLegend = w * 0.55
        let hLegend = h * 0.05

        const legend = svg.selectAll('.thisLegend')
          .data(legendVals)
          .enter()
          .append('g')
          .attr('class', 'thisLegend')
          .attr('transform', (d, i) => `translate(0,${i * 20})`)

        legend.append('rect')
          .attr('x', wLegend)
          .attr('y', hLegend + 30)
          .attr('width', 12)
          .attr('height', 12)
          .style('fill', (d, i) => colors(i))

        legend.append('text')
          .attr('x', wLegend + 20)
          .attr('y', hLegend + 42)
          .text((d, i) => d)
          .attr('class', 'textselected')
      })
    })

    //create axes
    svg.append('g')
      .attr('class', 'axis x')
      .attr('transform', `translate(0,${(h - margin.bottom)})`)
      .call(xAxis)
      .style('font-size', 14)
      .select('.domain').attr('transform', `translate(${0},${(yScale(0) - (h - margin.bottom))})`)

    svg.append('g')
      .attr('class', 'axis yl')
      .attr('transform', `translate(${margin.left},0)`)
      .call(yAxisL)
      .style('font-size', 14)

    svg.append('g')
      .attr('class', 'axis yr')
      .attr('transform', `translate(${(w - margin.right)},0)`)
      .call(yAxisR)
      .style('font-size', 14)

    svg.append('g')
      .attr('class', 'axis ygrid')
      .attr('transform', `translate(${margin.left},0)`)
      .call(yAxisGrid)
      .style('opacity', .2)

    // Define the div for the tooltip
    const tooltipDiv = d3.select('body').append('div')
      .attr('class', 'tooltip')
      .style('opacity', 0)
  }

  function drawGdpLine(data) {
    //define line
    let line = d3.line()
      .x(d => xScale(d.year) + (xScale.bandwidth() / 2))
      .y(d => yScale(d.gdp))
      .curve(d3.curveMonotoneX)

    //create line
    svg.append('path')
      .datum(data)
      .attr('id', 'line')
      .attr('d', line)
      .style('fill', 'none')
      .style('stroke', 'black')
      .style('stroke-width', 3)
  }

  function drawThisLine(data) {
    //define line
    let thisLine = d3.line()
      .x(d => xScale(d.year) + (xScale.bandwidth() / 2))
      .y(d => yScale(d[thisType]))
      .curve(d3.curveMonotoneX)

    //create line
    svg.append('path')
      .datum(data)
      .attr('id', 'thisLine')
      .attr('d', thisLine)
      .style('fill', 'none')
      .style('stroke', 'black')
      .style('stroke-width', 3)
      .style('opacity', 0)
      .transition().delay(barTransition).duration(500)
      .style('opacity', 1)
  }

  function drawBackbutton(data, series, keys) {

    //Create back button
    const backButton = svg.append('g')
      .attr('id', 'backButton')
      .style('opacity', 0) //Initially hidden
      .classed('unclickable', true) //Initially not clickable
      .attr('transform', `translate(${xScale.range()[0]},${yScale.range()[1]})`)

    backButton.append('rect')
      .attr('x', 15)
      .attr('y', -30)
      .attr('rx', 5)
      .attr('rx', 5)
      .attr('width', 70)
      .attr('height', 30)

    backButton.append('text')
      .attr('x', 22)
      .attr('y', -10)
      .html('&larr; Back')

    //Define click behavior
    backButton.on('click', function () {
      viewState = 0
      toggleBackButton()

      //Set y scale back to original domain
      yScale = d3.scaleLinear()
        .domain([d3.min(series, stackMin), d3.max(series, stackMax)])
        .range([h - margin.bottom, margin.top])
        .nice()

      //transition bars
      thisKeys.forEach((key, key_index) => {
        svg.selectAll('.thisBar-' + key)
          .data(thisSeries[key_index])
          .transition().duration(barTransition)
          .attr('y', d => yScale(d[1]))
          .attr('height', d => yScale(d[0]) - yScale(d[1]))
          .style('opacity', 0)
      })

      d3.selectAll('#bars').transition().duration(barTransition).remove()

      //update y axes
      let yAxisR = d3.axisRight()
        .scale(yScale)
        .ticks(8)
        .tickSizeOuter(0)

      let yAxisL = d3.axisLeft()
        .scale(yScale)
        .ticks(8)
        .tickSizeOuter(0)

      let yAxisGrid = d3.axisLeft()
        .scale(yScale)
        .ticks(8)
        .tickSizeOuter(0)
        .tickSizeInner(-w + margin.left + margin.right)
        .tickFormat('')

      svg.select('.axis.yl')
        .transition().duration(barTransition)
        .call(yAxisL)

      svg.select('.axis.yr')
        .transition().duration(barTransition)
        .call(yAxisR)

      svg.select('.axis.ygrid')
        .transition().duration(barTransition)
        .call(yAxisGrid)

      svg.select('.axis.x')
        .transition().duration(barTransition)
        .select('.domain').attr('transform', `translate(${0},${(yScale(0) - (h - margin.bottom))})`)

      //transition bars
      keys.forEach((key, key_index) => {

        const bars = svg.selectAll('.bar-' + key)
          .data(series[key_index])
          .transition().duration(barTransition)
          .style('opacity', 1)
          .attr('y', d => yScale(d[1]))
          .attr('height', d => yScale(d[0]) - yScale(d[1]))
      })

      //original legend
      d3.selectAll('.thisLegend').remove();
      d3.selectAll('.legend').classed('hidden', false)

      //remove thisLine
      d3.select('#thisLine').remove()

      //original gdp line
      d3.select('#line').transition().duration(barTransition * 2).style('opacity', 1)
    })
  }

  function drawLegend(data) {
    let wLegend = w * 0.55
    let hLegend = h * 0.05

    const legend = svg.selectAll('.legend')
      .data(data)
      .enter()
      .append('g')
      .attr('class', 'legend')
      .attr('transform', (d, i) => `translate(0,${i * 20})`)

    legend.append('rect')
      .attr('x', wLegend)
      .attr('y', hLegend + 30)
      .attr('width', 12)
      .attr('height', 12)
      .style('fill', (d, i) => colors(i))

    legend.append('text')
      .attr('x', wLegend + 20)
      .attr('y', hLegend + 42)
      //.attr('dy', '.35em')
      .text((d, i) => d)
      .attr('class', 'textselected')
  }

  function toggleBackButton() {
    //Select the button
    const backButton = d3.select('#backButton')

    //Decide whether to reveal or hide it
    if (viewState == 1) {

      //Reveal it

      //Set up dynamic button text
      const buttonText = '&larr; Back'

      //Set text
      backButton.select('text').html(buttonText)

      //Resize button depending on text width
      const rectWidth = Math.round(backButton.select('text').node().getBBox().width + 16)
      backButton.select('rect').attr('width', rectWidth)

      //Fade button in
      backButton.classed('unclickable', false)
        .transition()
        .duration(500)
        .style('opacity', 1)

    } else {

      //Hide it
      backButton.classed('unclickable', true)
        .transition()
        .duration(200)
        .style('opacity', 0)

    }
  }

  function stackMin(serie) {
    return d3.min(serie, d => d[0])
  }

  function stackMax(serie) {
    return d3.max(serie, d => d[1])
  }

  // % label for the y axis
  svg.append('text')
    .style('text-anchor', 'middle')
    .text('%')
    .attr('class', 'axis text')
    .attr('transform', `translate(${margin.left / 4},${h / 2}) rotate(0)`)
    .style('font-weight', 'bold')
    .style('pointer-events', 'none')

  // source
  svg.append('text')
    .style('text-anchor', 'middle')
    .attr('class', 'textselected')
    .text('Source: U.S. Bureau of Economic Analysis')
    .attr('transform', `translate(${(w * 0.75)},${(h * 0.925)}) rotate(0)`)
    .style('pointer-events', 'none')
}