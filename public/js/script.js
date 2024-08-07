$(document).ready(function () {
    function updateCellData() {
        $.ajax({
            url: '/api/sensors',
            method: 'GET',
            success: function (sensorData) {
                let waterMessage = sensorData.waterMessage;
                // update the current water temperature
                if (waterMessage == '') {
                    waterMessage = `${sensorData.waterTemperature.toFixed(1)} °F`;
                }

                $(`.cell-data[data-id='current-water-temp'] span`).text(
                    waterMessage,
                );

                // update the current room temperature
                let roomMessage = sensorData.roomMessage;
                if (roomMessage == '') {
                    roomMessage = `${sensorData.roomTemperature.toFixed(1)} °F`;
                }
                $(`.cell-data[data-id='current-room-temp'] span`).text(
                    roomMessage,
                );

                // update leak indication
                let leakMessage = sensorData.leakMessage;
                if (leakMessage == '') {
                    leakMessage = sensorData.leakPresent ? 'True' : 'False';
                }
                $(`.cell-data[data-id='leak-present'] span`).text(leakMessage);

                // update the ozone message
                updateOzoneStatus(sensorData);

                $(`.cell-data[data-id='pump-status'] span`).text(
                    sensorData.pumpStatus,
                );
            },
            error: function (xhr, status, error) {
                console.error('Error:', status, error);
            },
        });

        $.ajax({
            url: '/api/plunge',
            method: 'GET',
            success: function (data) {
                updatePlungeStatus(data);
            },
            error: function (xhr, status, error) {
                console.error('Error:', status, error);
            },
        });
    }

    updateCellData();
    setInterval(updateCellData, 5000);

    $('#ozone-power').click(function () {
        $.ajax({
            url: '/api/ozone',
            method: 'POST',
            success: function (data) {},
            error: function (xhr, status, error) {
                console.error(`Error: ${status} ${error}`);
            },
        });
    });

    $('#plunge-timer').click(function () {
        $.ajax({
            url: '/api/plunge',
            method: 'POST',
            success: function (data) {
                updatePlungeStatus(data);
            },
            error: function (xhr, status, error) {
                console.error(`Error: ${status} ${error}`);
            },
        });
    });

    function updatePlungeStatus(data) {
        if (data.running == true) {
            $('#plunge-timer').text('Stop Timer');
        } else {
            $('#plunge-timer').text('Start Timer');
        }
        $(`.cell-data[data-id='plunge-message'] span`).text(data.message);
        if (data.start_water_temp) {
            $(`.cell-data[data-id='plunge-start-temperature'] span`).text(
                data.start_water_temp,
            );
        }
        if (data.end_water_temp) {
            $(`.cell-data[data-id='plunge-end-temperature'] span`).text(
                data.end_water_temp,
            );
        }
        if (data.plunge_time) {
            $(`.cell-data[data-id='plunge-elapsed-time'] span`).text(
                data.plunge_time,
            );
        }
    }

    function updateOzoneStatus(sensorData) {
        $(`.cell-data[data-id='ozone-status'] span`).text(
            sensorData.ozoneStatus,
        );
        $(`.cell-data[data-id='ozone-start'] span`).text(sensorData.ozoneStart);
        $(`.cell-data[data-id='ozone-end'] span`).text(sensorData.ozoneEnd);
        $(`.cell-data[data-id='ozone-time-left'] span`).text(
            sensorData.ozoneTimeLeft,
        );

        if (sensorData.ozoneStatus == 'Running') {
            $(`#ozone-power`).text('Stop Ozone');
        } else {
            $(`#ozone-power`).text('Start Ozone');
        }
    }
});
