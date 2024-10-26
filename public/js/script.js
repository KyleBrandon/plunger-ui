$(document).ready(function () {
    let socket = new WebSocket('ws://10.0.10.240:8080/v2/status/ws');
    socket.onmessage = (event) => {
        let data = JSON.parse(event.data);

        updateCellData(data);
    };

    flatpickr('#filter-change-date', {
        enableTime: true,
        dateFormat: 'F, d Y H:i',
    });

    function updateCellData(sensorData) {
        updateTemperatureStatus(sensorData);
        updatePlungerStatus(sensorData);
        updateOzoneStatus(sensorData);
        updatePumpStatus(sensorData);
        updateLeakStatus(sensorData);
    }

    function updatePlungerStatus(data) {
        try {
            ps = data.plunge;

            updatePlungeButton(ps.running);

            if (data.water_temp) {
                $(`.cell-data[data-id='plunge-current-temperature'] span`).text(
                    data.water_temp.toFixed(1),
                );
            }
            if (ps.average_water_temp) {
                $(`.cell-data[data-id='plunge-avg-temperature'] span`).text(
                    ps.average_water_temp.toFixed(1),
                );
            }
            if (ps.expected_duration) {
                $(`.cell-data[data-id='plunge-duration'] span`).text(
                    secondsToHMS(ps.expected_duration),
                );
            }
            if (ps.remaining_time) {
                $(`.cell-data[data-id='plunge-remaining-time'] span`).text(
                    secondsToHMS(ps.remaining_time),
                );
            }
            if (ps.elapsed_time) {
                $(`.cell-data[data-id='plunge-elapsed-time'] span`).text(
                    secondsToHMS(ps.elapsed_time),
                );
            }
        } catch (e) {
            console.error('Error parsing Plunge server status', e);
        }
    }

    function updateTemperatureStatus(sensorData) {
        let waterMessage = sensorData.water_temp_error;
        if (!waterMessage) {
            waterMessage = `${sensorData.water_temp.toFixed(1)} °F`;
        }
        $(`.cell-data[data-id='current-water-temp'] span`).text(waterMessage);

        // update the current room temperature
        let roomMessage = sensorData.room_temp_error;
        if (!roomMessage) {
            roomMessage = `${sensorData.room_temp.toFixed(1)} °F`;
        }
        $(`.cell-data[data-id='current-room-temp'] span`).text(roomMessage);
    }

    function updateOzoneStatus(sensorData) {
        let ozoneStatus = sensorData.ozone;

        $(`.cell-data[data-id='ozone-status'] span`).text(
            ozoneStatus.running ? 'On' : 'Off',
        );
        $(`.cell-data[data-id='ozone-start'] span`).text(
            toLocaleTime(new Date(ozoneStatus.start_time)),
        );
        $(`.cell-data[data-id='ozone-end'] span`).text(
            toLocaleTime(new Date(ozoneStatus.end_time)),
        );
        $(`.cell-data[data-id='ozone-time-left'] span`).text(
            secondsToHMS(ozoneStatus.seconds_left),
        );
        $(`.cell-data[data-id='ozone-message'] span`).text(ozoneStatus.status);

        if (ozoneStatus.running) {
            $(`#ozone-power`).text('Stop Ozone');
        } else {
            $(`#ozone-power`).text('Start Ozone');
        }
    }

    function updatePumpStatus(sensorData) {
        let pumpMessage = sensorData.pump_error;
        if (!pumpMessage) {
            pumpMessage = sensorData.pump_on ? 'On' : 'Off';
        }

        $(`.cell-data[data-id='pump-status'] span`).text(pumpMessage);

        if (sensorData.pump_on) {
            $('#pump-power').text('Stop Pump');
        } else {
            $('#pump-power').text('Start Pump');
        }
    }

    function updateLeakStatus(sensorData) {
        // update leak indication
        let leakMessage = sensorData.leak_error;
        if (!leakMessage) {
            leakMessage = sensorData.leak_detected ? 'True' : 'False';
        }
        $(`.cell-data[data-id='leak-present'] span`).text(leakMessage);
    }

    $('#filter-change-form').on('submit', async function (e) {
        e.preventDefault();

        const date = $('#filter-change-date').val();
        $.ajax({
            url: '/api/change-filter',
            method: 'POST',
            contentType: 'application/json',
            data: JSON.stringify({ date: date }),
            success: function (data) {
                console.log('filter changed');
            },
            error: function (xhr, status, error) {
                console.error(`Error: ${status} ${error}`);
            },
        });
    });

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

    $('#pump-power').click(function () {
        debounceButton('#pump-power');

        // TODO: read the current pump status instead of relying on the UI
        let pumpStatus = $(`.cell-data[data-id='pump-status'] span`).text();
        message = 'Are you certain you wish to turn the pump off?';

        if (pumpStatus != 'On') {
            message = 'Are you certain you wish to turn the pump on?';
        }

        var userResponse = confirm(message);

        if (userResponse) {
            $.ajax({
                url: '/api/pump',
                method: 'POST',
                success: function (data) {},
                error: function (xhr, status, error) {
                    console.error(`Error: ${status} ${error}`);
                },
            });
        }
    });

    $('#plunge-timer').click(function () {
        debounceButton('#plunge-timer');

        $.ajax({
            url: '/api/plunge',
            method: 'POST',
            success: function (data) {
                updatePlungeButton(data.running);
            },
            error: function (xhr, status, error) {
                console.error(`Error: ${status} ${error}`);
            },
        });
    });

    function debounceButton(buttonId) {
        $(buttonId).prop('disabled', true);
        setTimeout(() => {
            $(buttonId).prop('disabled', false);
        }, 500);
    }

    function updatePlungeButton(running) {
        if (running) {
            $('#plunge-timer').text('Stop Timer');
            $(`.cell-data[data-id='plunge-message'] span`).text(
                'Timer running',
            );
        } else {
            $('#plunge-timer').text('Start Timer');
            $(`.cell-data[data-id='plunge-message'] span`).text(
                'Timer stopped',
            );
        }
    }

    function secondsToHMS(seconds) {
        let hours = Math.floor(seconds / 3600);
        let minutes = Math.floor((seconds % 3600) / 60);
        let secs = Math.floor(seconds % 60);
        return (
            hours.toString().padStart(2, '0') +
            ':' +
            minutes.toString().padStart(2, '0') +
            ':' +
            secs.toString().padStart(2, '0')
        );
    }

    function toLocaleTime(date) {
        const userTimeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
        const options = {
            timeZone: userTimeZone, // Use the desired time zone, or leave it out for auto-detect
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
        };

        return new Intl.DateTimeFormat('en-US', options).format(date);
    }
});
