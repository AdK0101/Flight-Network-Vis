// Create a Leaflet map centered on a specific location
var map = L.map('map', {
    preferCanvas: true,
    maxBounds: L.latLngBounds(L.latLng(-90, -180), L.latLng(90, 180)) // Set the maximum bounds for the map
}).setView([51.505, -0.09], 3);

// Add the CartoDB VoyagerNoLabels tile layer
L.tileLayer('https://cartodb-basemaps-{s}.global.ssl.fastly.net/rastertiles/voyager_nolabels/{z}/{x}/{y}.png', {
    attribution: '© CARTO' // Attribution for the tile layer
}).addTo(map);

// Add zoom control buttons
L.control.zoom({
    position: 'bottomright'
}).addTo(map);

// Create D3 overlay for the Leaflet map
var svgOverlay = L.svg();
svgOverlay.addTo(map);

// Select the SVG overlay for drawing D3 graphics
var svg = d3.select(map.getPanes().overlayPane).select('svg');

// Load the airport data from the CSV file
d3.csv('data/airport_data_restricted.csv').then(function (airportData) {
    // Preprocess the airport data
    var nodes = airportData.map(function (d) {
        return {
            id: d.icao,
            name: d.name,
            longitude: +d.longitude,
            latitude: +d.latitude,
            iata: d.iata,
            city: d.city,
        };
    });

    var markerToNodeMap = new Map();

    /// Create a marker cluster group with custom maxClusterRadius
    var markers = L.markerClusterGroup({
        maxClusterRadius: 40 // Adjust this value to control when markers start clustering
    });

    nodes.forEach(function (node) {
        var marker = L.circleMarker([node.latitude, node.longitude], {
            radius: 10,
            color: 'white',
            fillColor: '#c76a24',
            fillOpacity: 1
        });

        // Second tooltip for city and name (initially hidden)
        var iataTooltip = L.tooltip({
            permanent: true,
            direction: 'auto',
            offset: [10, 0],
        }).setContent(node.iata);

        marker.bindTooltip(iataTooltip);

        // Second tooltip for city and name (initially hidden)
        var cityAndNameTooltip = L.tooltip({
            permanent: false,
            direction: 'auto',
            offset: [10, 0],
        }).setContent('City: ' + node.city + '<br>' + 'Airport: ' + node.name);

        // Handle mouseover event to show the city and name tooltip and hide the original tooltip
        marker.on('mouseover', function (e) {
            marker.unbindTooltip(); // Hide the original tooltip
            marker.bindTooltip(cityAndNameTooltip).openTooltip(); // Show the city and name tooltip
        });

        // Handle mouseout event to revert back to the original tooltip
        marker.on('mouseout', function (e) {
            marker.unbindTooltip(); // Hide the city and name tooltip
            marker.bindTooltip(iataTooltip).openTooltip(); // Show the original tooltip
        });

        node.marker = marker; // Assign the marker to the node object


        markerToNodeMap.set(marker, node);

        markers.addLayer(marker); // Add the marker to the cluster group
    });

    // Add the marker cluster group to the map
    map.addLayer(markers);

    console.log(markerToNodeMap);

    var clusterMap = new Map();

    // Initial population of clusterMap
    markers.eachLayer((marker) => {
        if (marker instanceof L.MarkerCluster) {
            let markers = marker.getAllChildMarkers();
            let nodes = markers.map((m) => markerToNodeMap.get(m));
            clusterMap.set(marker, nodes);
        }
    });


    map.on('zoomend', () => {
        clusterMap.clear();
        map.eachLayer((l) => {
            if (l instanceof L.MarkerCluster) {
                let markers = l.getAllChildMarkers()
                let nodes = markers.map((m) => markerToNodeMap.get(m))
                clusterMap.set(l, nodes)
            }
        })
        console.log(clusterMap)
    });

    // Load the flight data from the CSV file
    d3.csv('data/flight_data_restricted.csv').then(function (flightData) {
        // Process each flight data and create D3.js links
        var links = createLinks(flightData, nodes);
        var curve_strength = 0.025; // Adjust this value to control the curve of the links


        var link = svg.selectAll('.link')
            .data(links)
            .enter()
            .append('path') // Use 'path' instead of 'line'
            .attr('class', 'link')
            .style('stroke', '#333130')
            //.style('stroke', 'url(#sourceToTargetGradient)')
            .style('stroke-width', '2')
            .style('fill', 'none') // Since paths are used, set fill to none
            .style('opacity', '0')
            .style('pointer-events', 'visiblePainted')
        //.attr('marker-mid', 'url(#arrowhead)');



        // Function to update the link positions when the map view changes
        // Define the path generator
        var lineGenerator = d3.line()
            .curve(d3.curveNatural)
            .x(function (d) { return map.latLngToLayerPoint([d.latitude, d.longitude]).x; })
            .y(function (d) { return map.latLngToLayerPoint([d.latitude, d.longitude]).y; });

        function updateLinkPositions() {
            link.attr('d', function (d) {
                // Construct the path data using the line generator
                var sourcePoint = { latitude: d.source.latitude, longitude: d.source.longitude };
                var targetPoint = { latitude: d.target.latitude, longitude: d.target.longitude };
                var dx = targetPoint.latitude - sourcePoint.latitude;
                var dy = targetPoint.longitude - sourcePoint.longitude;
                // at the midpoint of the link, add a small curve with curve strgnth
                var midpointPoint = {
                    latitude: sourcePoint.latitude + dx * 0.5 - dy * curve_strength,
                    longitude: sourcePoint.longitude + dy * 0.5 + dx * curve_strength
                };
                return lineGenerator([sourcePoint, midpointPoint, targetPoint]);
            });
        }


        // Add event listener for the map's "move" event to update link positions
        map.on("move", updateLinkPositions);

        // Append SVG marker for arrowhead to the 'svg' element
        var defs = svg.append('defs');
        var arrowheadMarker = defs.append('marker')
            .attr('id', 'arrowhead')
            .attr('markerWidth', '10')
            .attr('markerHeight', '10')
            .attr('refX', '5')
            .attr('refY', '3')
            .attr('orient', 'auto')
            .attr('markerUnits', 'strokeWidth');

        arrowheadMarker.append('path')
            .attr('d', 'M0,0 L0,6 L9,3 z') // Define the arrowhead path
            .style('fill', '#333130');

        link.each(function (d) {
            var gradientId = 'gradient-' + d.source.id + '-' + d.target.id;

            var gradient = svg.append("defs")
                .append("linearGradient")
                .attr("id", gradientId);

            var arrowheadDirection = Math.atan2(d.target.latitude - d.source.latitude, d.target.longitude - d.source.longitude);

            if (arrowheadDirection < -Math.PI / 2 || arrowheadDirection > Math.PI / 2) {
                gradient.attr("x1", "100%")
                    .attr("y1", "0%")
                    .attr("x2", "0%")
                    .attr("y2", "0%");
            } else {
                gradient.attr("x1", "0%")
                    .attr("y1", "0%")
                    .attr("x2", "100%")
                    .attr("y2", "0%");
            }

            gradient.append("stop")
                .attr("offset", "0%")
                .style("stop-color", "orange");




            gradient.append("stop")
                .attr("offset", "30%")
                .style("stop-color", "grey");

            gradient.append("stop")
                .attr("offset", "100%")
                .style("stop-color", "grey");




            d3.select(this)
                .style("stroke", "url(#" + gradientId + ")");
        });

        // Function to calculate the number of links from source to dest within the selected hour
        function getLinkCount(sourceId, targetId, selectedHour) {
            return links.reduce(function (count, link) {
                if (link.source.id === sourceId && link.target.id === targetId && selectedHour >= link.first_hour && selectedHour <= link.last_hour) {
                    return count + 1;
                }
                return count;
            }, 0);
        }

        // Function to update link thickness based on the number of links from source to dest
        function updateLinkThickness(selectedHour) {
            // Calculate the minimum and maximum link counts
            var minLinkCount = d3.min(links, function (d) {
                return getLinkCount(d.source.id, d.target.id, selectedHour);
            });
            var maxLinkCount = d3.max(links, function (d) {
                return getLinkCount(d.source.id, d.target.id, selectedHour);
            });

            var linkThicknessScale = d3.scaleLinear()
                .domain([minLinkCount, maxLinkCount])
                .range([1, 5]);

            link.style('stroke-width', function (d) {
                var count = getLinkCount(d.source.id, d.target.id, selectedHour);
                return linkThicknessScale(count);
            });
        }


        // Update links based on the time range and link thickness
        const timeRangeInput = document.getElementById("timeRange");
        timeRangeInput.addEventListener("input", function () {
            const selectedHour = +this.value;
            updateLinksVisibility(selectedHour);
            updateLinkThickness(selectedHour);
        });

        // Update links visibility function using D3.js
        function updateLinksVisibility(selectedHour) {
            link.style('opacity', function (d) {
                return selectedHour >= d.first_hour && selectedHour <= d.last_hour ? 1 : 0;
            });
        }

        // Update the hour value display
        const hourValueElement = document.getElementById("hourValue");
        timeRangeInput.addEventListener("input", function () {
            const selectedHour = +this.value;
            hourValueElement.textContent = selectedHour;
        });

        updateLinksVisibility(0);
        updateLinkThickness(0);
        updateLinkPositions();

    }).catch(function (error) {
        // Handle any errors that occur during flight data loading
        console.error('Error loading flight data:', error);
    });
}).catch(function (error) {
    // Handle any errors that occur during airport data loading
    console.error('Error loading airport data:', error);
});

function createLinks(flightData, nodes) {
    const links = [];
    flightData.forEach(function (d) {
        const sourceNode = nodes.find(function (node) {
            return node.id === d.origin;
        });
        const targetNode = nodes.find(function (node) {
            return node.id === d.destination;
        });
        if (sourceNode && targetNode) {
            links.push({
                source: sourceNode,
                target: targetNode,
                first_hour: +d.first_hour,
                last_hour: +d.last_hour,
                origin: sourceNode.name,
                destination: targetNode.name,
            });
        }
    });
    return links;
}