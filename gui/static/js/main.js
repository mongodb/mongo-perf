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
    // `d` is the original data object for the row
    return '<table cellpadding="5" cellspacing="0" border="0" style="padding-left:50px;">' +
        '<tr>' +
        '<td>Full name:</td>' +
        '<td>' + d.name + '</td>' +
        '</tr>' +
        '<tr>' +
        '<td>Extension number:</td>' +
        '<td>' + d.extn + '</td>' +
        '</tr>' +
        '<tr>' +
        '<td>Extra info:</td>' +
        '<td>And any further details here (images etc)...</td>' +
        '</tr>' +
        '</table>';
}

$(document).ready(function () {
    var table = $('#selectTable').DataTable({
        "ajax": "/catalog",
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
            {"data": "label","class": 'click-selectable'},
            {"data": "version","class": 'click-selectable'},
            {"data": "date","class": 'click-selectable'},
            {"data": "githash_link","class": 'click-selectable'},
            {"data": "server_storage_engine","class": 'click-selectable'}

        ],
        "createdRow": function ( row, data, index ) {
            row.setAttribute('data-recordid',data['_id']);
        }
    });

    $('#selectTable tbody').on('click', 'td.click-selectable', function () {
        var tr = $(this).closest('tr');
        tr.toggleClass('selected');
    });

    // Add event listener for opening and closing details
    $('#selectTable tbody').on('click', 'td.details-control', function () {
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
});