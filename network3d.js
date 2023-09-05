const markerImageUrl = 'data/Red-Circle-PNG-Images-HD.png'; // Replace with the actual URL of the circle image

// Load airport data
d3.csv("data/airport_data_restricted.csv").then(airportData => {
    // Process airport data
    const airports = airportData.map(d => ({
        icao: d.icao,
        name: d.name,
        lat: parseFloat(d.latitude),
        lng: parseFloat(d.longitude),
        iata: d.iata,
    }));

    // Load flight data
    d3.csv("data/flight_data_restricted.csv").then(flightData => {
        // Process flight data
        const flights = flightData.map(d => ({
            origin: d.origin,
            destination: d.destination,
            first_hour: parseInt(d.first_hour),
            last_hour: parseInt(d.last_hour),
            callsign: d.callsign
        }));

        // Loag flight_trajectory data
        d3.csv("data/flight_traj_restricted.csv").then(trajectoryData => {
            // Process flight_trajectory data
            const trajectories = trajectoryData.map(d => ({
                callsign: d.callsign,
                icao: d.icao24,
                lat: parseFloat(d.lat),
                lon: parseFloat(d.lon),
                // scale altitude down
                altitude: parseFloat(d.geoaltitude) * 0.00001,
            }
            ));
            console.log("Trajectories:", trajectories);
            // Filter flights based on existing origin and destination airports
            const filteredFlights = flights.filter(d => {
                const originAirport = airports.find(airport => airport.icao === d.origin);
                const destAirport = airports.find(airport => airport.icao === d.destination);
                return originAirport && destAirport;
            });

            
            // Update the existing code to include filtered flights
            const myGlobe = Globe()
                .globeImageUrl('//unpkg.com/three-globe/example/img/earth-night.jpg')
                .htmlElementsData(airports)
                .htmlElement(d => {
                    const container = document.createElement('div');
                    container.style.position = 'relative';

                    const marker = document.createElement('img');
                    marker.src = markerImageUrl;
                    marker.style.color = 'red';
                    marker.style.width = '10px';
                    marker.style.pointerEvents = 'auto';
                    marker.style.cursor = 'pointer';
                    marker.onclick = () => console.info(d);
                    container.appendChild(marker);

                    const label = document.createElement('div');
                    label.textContent = d.iata;
                    label.style.position = 'absolute';
                    label.style.top = '-20px';
                    label.style.left = '0';
                    label.style.width = '100%';
                    label.style.textAlign = 'center';
                    label.style.color = 'white';
                    container.appendChild(label);

                    return container;
                })
                //.arcLabel(d => `${d.origin} &#8594; ${d.destination}`)
                .arcLabel(d => {
                    const traj = trajectories.find(traj => traj.callsign === d.callsign);
                    // if not traj or not traj.altitude, return empty string
                    if (!traj || isNaN(traj.altitude)) {
                        return `${d.origin} &#8594; ${d.destination} (Note: Simulated Flight Altitude)`;
                    } else {
                        return `${d.origin} &#8594; ${d.destination}`;   
                    }
                })
                .arcStartLat(d => {
                    const originAirport = airports.find(airport => airport.icao === d.origin);
                    return originAirport ? originAirport.lat : 0;
                })
                .arcStartLng(d => {
                    const originAirport = airports.find(airport => airport.icao === d.origin);
                    return originAirport ? originAirport.lng : 0;
                })
                .arcEndLat(d => {
                    const destAirport = airports.find(airport => airport.icao === d.destination);
                    return destAirport ? destAirport.lat : 0;
                })
                .arcEndLng(d => {
                    const destAirport = airports.find(airport => airport.icao === d.destination);
                    if (!destAirport) {
                        console.log(d.destination);
                    }
                    return destAirport ? destAirport.lng : 0;
                })
            
                .arcAltitude(d => {
                    const traj = trajectories.find(traj => traj.callsign === d.callsign);

                    if (traj && !isNaN(traj.altitude)) {
                        return traj.altitude;
                        console.log(traj.altitude);
                    }
                    // Get the min and max altitudes in trajs
                    const minAlt = d3.min(trajectories, d => d.altitude);
                    const maxAlt = d3.max(trajectories, d => d.altitude);
                    

                    // obtain the average
                    const avgAlt = (minAlt + maxAlt) / 2;
                    console.log("Min Altitude:", avgAlt);
                    return avgAlt + Math.random() * 0.01;
                })                
                .arcColor(() => ['rgba(0, 255, 0, 0.5)', 'rgba(255, 0, 0, 0.5)'])
                .pointsMerge(true)
                .arcsData(filteredFlights);

            myGlobe(document.getElementById('globeViz')).pointOfView({ lat: 37.6, lng: -16.6, altitude: 0.4 }, 4000);

            // Update the hour value when timebar is scrolled
            const timeRange = document.getElementById('timeRange');
            const hourValue = document.getElementById('hourValue');
            timeRange.addEventListener('input', () => {
                hourValue.textContent = timeRange.value;
                const currentTime = parseInt(timeRange.value);
                const timeFilteredFlights = filteredFlights.filter(d => d.first_hour <= currentTime && currentTime <= d.last_hour);
                myGlobe.arcsData(timeFilteredFlights);

                // Update arc positions and altitudes
                myGlobe.arcsTransitionDuration(0); // Disable transition for immediate effect
                myGlobe.arcsData().forEach((arc, index) => {
                    const originAirport = airports.find(airport => airport.icao === arc.origin);
                    const destAirport = airports.find(airport => airport.icao === arc.destination);
                    const originPosition = [originAirport.lng, originAirport.lat];
                    const destPosition = [destAirport.lng, destAirport.lat];
                    const altitude = (index + 1) * 0.1; // Adjust the altitude based on the index
                    const arcPosition = GlobeUtils.interpolateCurve(originPosition, destPosition, altitude);
                    arc.curvePosition(arcPosition);
                });
                myGlobe.arcsTransitionDuration(2000); // Re-enable transition
            });
        });
    });

});

