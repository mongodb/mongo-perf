// Setup selecting and checkboxes
function captureSelected() {
    var recordIds = $('#selectTable').DataTable().rows('.selected').nodes().map(function (index) {
        return $(index).data("recordid");
    });
    recordIds.each(function (entry) {
        $('<input>').attr({
            type: 'hidden',
            name: 'id',
            value: entry
        }).appendTo('form');
    });
    return true;
}

/* Formatting function for row details - modify as you need */
function format(d) {
    var platform_icon = 'fa-laptop';
    var platform = d.platform.toLowerCase();
    if (platform == 'linux') platform_icon = 'fa-linux';
    else if (platform == 'windows') platform_icon = 'fa-windows';
    else if (platform == 'darwin') platform_icon = 'fa-apple';

    var test_suites = d.test_suites.join(', ');
    //var threads = d.threads.join(', ');

    if(d.writeOptions) {
        var safe_icon = 'fa-check';
        var safe_class = 'writeOptionTrue';
        if (d.writeOptions.safeGLE == 'false') {
            safe_icon = 'fa-times';
            safe_class = 'writeOptionFalse';
        }

        var cmdmode_icon = 'fa-check';
        var cmdmode_class = 'writeOptionTrue';
        if (d.writeOptions.writeCmdMode == 'false') {
            cmdmode_icon = 'fa-times';
            cmdmode_class = 'writeOptionFalse';
        }


        var j_icon = 'fa-check';
        var j_class = 'writeOptionTrue';
        if (d.writeOptions.writeConcernJ == 'false') {
            j_icon = 'fa-times';
            j_class = 'writeOptionFalse';
        }
    }

    // `d` is the original data object for the row
    return '<table cellpadding="5" cellspacing="0" border="0" style="padding-left:50px;">' +
        '<tr>' +
        '<td>Platform:</td>' +
        '<td><i class="fa fa-fw ' + platform_icon + '"></i>&nbsp; ' + d.platform + '</td>' +
        '</tr>' +
        '<tr>' +
        '<td>Suites:</td>' +
        '<td>' + test_suites + '</td>' +
        '</tr>' +
        '<tr>' +
        '<td>Run Time (h:m:s):</td>' +
        '<td>' + d.run_time + '</td>' +
        '</tr>' +
        '<tr>' +
        '<tr>' +
        '<td>Topology:</td>' +
        '<td>' + d.topology+ '</td>' +
        '</tr>' +
        //'<tr>' +
        //'<td>Threads:</td>' +
        //'<td>' + threads + '</td>' +
        //'</tr>' +
        '<tr>' +
        '<td>Write Options:</td>' +
        '<td>' +
        (!d.writeOptions ? " unavailable " :
        '<div class="writeOptionCell ' + safe_class + '">&nbsp;safe:&nbsp;<i class="fa fa-fw ' + safe_icon + '"></i></div>' +
        '<div class="writeOptionCell ' + cmdmode_class + '">&nbsp;write cmd:&nbsp;<i class="fa fa-fw ' + cmdmode_icon + '"></i></div>' +
        '<div class="writeOptionCell ' + j_class + '">&nbsp;j:&nbsp;<i class="fa fa-fw ' + j_icon + '"></i></div>' +
        '<div class="writeOptionWCell">&nbsp;w:&nbsp;' + d.writeOptions.writeConcernW + '</div>'
        )+
        '</td>' +
        '</tr>' +
        '</table>';
}

$(document).ready(function () {
    var table = $('#selectTable').DataTable({
        "data": data,
        "bPaginate": false,
        "bLengthChange": false,
        "bInfo": false,
        "bSortable": true,
        "bAutoWidth": false,
        "dom": "lrtip",
        "responsive": true,
        "idSrc": "_id",

        "columns": [
            {
                "class": 'details-control',
                "orderable": false,
                "data": null,
                "defaultContent": ''
            },
            {"data": "label", "class": 'click-selectable'},
            {"data": "version", "class": 'click-selectable'},
            {
                "data": "run_date.display",
                "class": 'click-selectable'
            },
            {
                "data": "commit",
                "class": 'click-selectable',
                "render": function (data, type, row) {
                    if (type === 'display') {
                        return "<a href=\"https://github.com/mongodb/mongo/commit/" + data + "\" target=\"_blank\">" + data.substr(0, 7) + "...</a>"
                    }
                    if (type === 'sort') {
                        return row.commit_date.timestamp;
                    }
                    return data;
                }
            },
            {"data": "server_storage_engine", "class": 'click-selectable'}

        ],
        "createdRow": function (row, data, index) {
            row.setAttribute('data-recordid', data['_id']);
        }
    });

    $('#selectTable tbody')
        .on('click', 'td.click-selectable', function () {
            var tr = $(this).closest('tr');
            tr.toggleClass('selected');
        })
        .on('click', 'td.details-control', function () {
            var tr = $(this).closest('tr');
            var row = table.row(tr);

            if (row.child.isShown()) {
                // This row is already open - close it
                row.child.hide();
                tr.removeClass('shown');
            }
            else {
                // Open this row
                row.child(format(row.data())).show();
                tr.addClass('shown');
            }
        });

    $('#labelfield').on('keyup change', function () {
        table.column(1).search(this.value).draw();
    });
    $('#version_filter')
        .on('keyup change', function () {
            table.draw();
        })
        .multiselect({
            buttonContainer: '<div class="version-field-container btn-group" />',
            enableFiltering: true,
            numberDisplayed: 1
        });
    $('#version_reset_button').on('click', function() {
        $('#version_filter option').each(function () {
            $(this).prop('selected', false);
        });
        $('#version_filter').multiselect('refresh');
        table.draw();
    });
    $('#topology_filter')
        .on('keyup change', function () {
            table.draw();
        })
        .multiselect({
            buttonContainer: '<div class="topology-field-container btn-group" />',
            enableFiltering: true,
            numberDisplayed: 1
        });
    $('#topology_reset_button').on('click', function() {
        $('#topology_filter option').each(function () {
            $(this).prop('selected', false);
        });
        $('#topology_filter').multiselect('refresh');
        table.draw();
    });
    $('#commitfield').on('keyup change', function () {
        table.column(4).search(this.value).draw();
    });
    $('#engine_filter')
        .on('keyup change', function () {
            table.draw();
        })
        .multiselect({
            buttonContainer: '<div class="engine-field-container btn-group" />',
            numberDisplayed: 1
        });
    $('#engine_reset_button').on('click', function() {
        $('#engine_filter option').each(function () {
            $(this).prop('selected', false);
        });
        $('#engine_filter').multiselect('refresh');
        table.draw();
    });
    $('#platform_filter')
        .on('keyup change', function () {
            table.draw();
        })
        .multiselect({
            buttonContainer: '<div class="platform-filter-container btn-group" />'
        });
    $('#platform_reset_button').on('click', function() {
        $('#platform_filter option').each(function () {
            $(this).prop('selected', false);
        });
        $('#platform_filter').multiselect('refresh');
        table.draw();
    });
    $('#test_filter')
        .on('keyup change', function () {
            table.draw();
        })
        .multiselect({
            buttonContainer: '<div class="test-filter-container btn-group" />',
            enableFiltering: true,
            numberDisplayed: 0
        });
    $('#test_reset_button').on('click', function() {
        $('#test_filter option').each(function () {
            $(this).prop('selected', false);
        });
        $('#test_filter').multiselect('refresh');
        table.draw();
    });

    $.fn.dataTable.ext.search.push(
        function (settings, data, dataIndex) {

            var table_settings = $('#selectTable').DataTable().settings();
            var full_data = table_settings.data()[dataIndex];

            var show = true;

            if ($('.version-field-container input:checked').length){
                var show_for_version = false;
                $('.version-field-container input:checked').each(function () {
                    show_for_version = show_for_version | (full_data.version == $(this).attr('value'));
                });
                show = show & show_for_version;
            }
            if ($('.topology-field-container input:checked').length){
                var show_for_topology = false;
                $('.topology-field-container input:checked').each(function () {
                    show_for_topology = show_for_topology | (full_data.topology == $(this).attr('value'));
                });
                show = show & show_for_topology;
            }

            if ($('.engine-field-container input:checked').length){
                var show_for_engine = false;
                $('.engine-field-container input:checked').each(function () {
                    show_for_engine = show_for_engine | (full_data.server_storage_engine == $(this).attr('value'));
                });
                show = show & show_for_engine;
            }

            var show_for_rundate = true;
            if ($('#rundate_filter').val() != "") {
                show_for_rundate = false;
                if (full_data.run_date.timestamp >= $('#rundate_filter').data('daterangepicker').startDate.unix()
                    && full_data.run_date.timestamp <= $('#rundate_filter').data('daterangepicker').endDate.unix())
                {
                    show_for_rundate = true
                }
                show = show & show_for_rundate;
            }

            var show_for_commitdate = true;
            if ($('#commit_date_filter').val() != "") {
                show_for_commitdate = false;
                if (full_data.commit_date.timestamp >= $('#commit_date_filter').data('daterangepicker').startDate.unix()
                    && full_data.commit_date.timestamp <= $('#commit_date_filter').data('daterangepicker').endDate.unix())
                {
                    show_for_commitdate = true
                }
                show = show & show_for_commitdate;
            }

            if ($('.platform-filter-container input:checked').length){
                var show_for_platform = false;
                $('.platform-filter-container input:checked').each(function () {
                    show_for_platform = show_for_platform | (full_data.platform == $(this).attr('value'));
                });
                show = show & show_for_platform;
            }

            if ($('.test-filter-container input:checked').length){
                var show_for_test = false;
                $('.test-filter-container input:checked').each(function () {
                    show_for_test = show_for_test | (full_data.tests.indexOf($(this).attr('value'))>-1);
                });
                show = show & show_for_test;
            }

            return show;
        }
    );

    $('#rundate_filter')
        .on('cancel.daterangepicker', function (ev, picker) {
            //do something, like clearing an input
            $(this).val('');
            table.draw();
        })
        .on('apply.daterangepicker', function (ev, picker) {
            table.draw();
        })
        .daterangepicker({timePicker: false, format: 'YYYY-MM-DD'});

    $('#commit_date_filter')
        .on('cancel.daterangepicker', function (ev, picker) {
            //do something, like clearing an input
            $(this).val('');
            table.draw();
        })
        .on('apply.daterangepicker', function (ev, picker) {
            table.draw();
        })
        .daterangepicker({timePicker: false, format: 'YYYY-MM-DD'});
});

