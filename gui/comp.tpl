<!doctype html>
<html lang="us">
<head>
    <meta charset="utf-8">
    <title>MongoDB Performance Benchmarks</title>
    <link href="static/css/jquery-ui-1.10.1.custom.min.css" rel="stylesheet">
    <link href="static/css/perf_style.css" rel="stylesheet">
    <link href="static/css/page.css" rel="stylesheet">
    <link href="static/DataTables-1.10.4/media/css/jquery.dataTables.css" rel="stylesheet">
    <link href="static/bootstrap-3.3.0-dist/css/bootstrap.min.css" rel="stylesheet">
    <script type="text/javascript" src="static/js/jquery-1.9.1.min.js"></script>
    <script type="text/javascript" src="static/js/jquery-ui-1.10.1.custom.min.js"></script>
    <script type="text/javascript" src="static/DataTables-1.10.4/media/js/jquery.dataTables.js"></script>
    <script type="text/javascript" src="static/bootstrap-3.3.0-dist/js/bootstrap.js"></script>
    <script type="text/javascript" src="static/js/perf_lib.js"></script>
    <script type="text/javascript" src="static/js/main.js"></script>
    <script>
        $(document).ready(function () {
//            $('#selectTable').dataTable({
//                "bPaginate": false,
//                "bLengthChange": false,
//                "bInfo": false,
//                "bSortable": true,
//                "bAutoWidth": true,
//                "dom": "lrtip",
//                responsive: true
//            });
//
//            var table = $('#selectTable').DataTable();
//
//            //manually set filtering up
//            $('#labelfield').on('keyup change', function () {
//                table.column(1).search(this.value).draw();
//            });
//            $('#versionfield').on('keyup change', function () {
//                table.column(2).search(this.value).draw();
//            });
//            //TODO get date range working
//            $('#datefield').on('keyup change', function () {
//                table.column(3).search(this.value).draw();
//            });
//            $('#commitfield').on('keyup change', function () {
//                table.column(4).search(this.value).draw();
//            });
//            $('#enginefield').on('keyup change', function () {
//                table.column(5).search(this.value).draw();
//            });
//
//            $('#selectTable tbody').on('click', 'tr', function () {
//                $(this).toggleClass('selected');
//                if (!$(this).find('input').is(':checked')) {
//                    $(this).find('input').attr('checked', 'checked');
//                }
//                else {
//                    $(this).find('input').attr('checked', null);
//                }
//
//            });
        });
    </script>
</head>
<body>
<div id="wrapper">

    <!-- Sidebar -->
    <div id="sidebar-wrapper">
        <ul class="sidebar-nav">
            <li class="sidebar-brand">
                <a href="#">Start Bootstrap</a>
            </li>
            <li>
                <a href="#">Dashboard</a>
            </li>
            <li>
                <a href="#">Shortcuts</a>
            </li>
            <li>
                <a href="#">Overview</a>
            </li>
            <li>
                <a href="#">Events</a>
            </li>
            <li>
                <a href="#">About</a>
            </li>
            <li>
                <a href="#">Services</a>
            </li>
            <li>
                <a href="#">Contact</a>
            </li>
        </ul>
    </div>
    <div class="container-fluid">

        <div class="navbar navbar-default navbar-fixed-top" role="navigation">
            <div class="container">
                <div class="navbar-header">
                    <button type="button" class="navbar-toggle" data-toggle="collapse" data-target=".navbar-collapse">
                        <span class="sr-only">Toggle navigation</span>
                        <span class="icon-bar"></span>
                        <span class="icon-bar"></span>
                        <span class="icon-bar"></span>
                    </button>
                    <a class="navbar-brand" href="#">MongoDB Benchmark Results</a>
                </div>
                <div class="navbar-collapse collapse">
                    <ul class="nav navbar-nav">
                        <li><a href="/">Home</a></li>
                    </ul>
                </div>
                <!--/.nav-collapse -->
            </div>
        </div>
        <div id="selection" class="row">
            <form name="custom_form" id="custom_form" action="results"
                  method="get">
                <button onclick="captureSelected()" action="submit" class="btn btn-primary">Submit</button>
                <table id="selectTable" class="table table-striped display">
                    <thead>
                    <tr>
                        <th></th>
                        <th><input type="text" id="labelfield" placeholder="Label Filter"/></th>
                        <th><input type="text" id="versionfield" placeholder="Version Filter"/></th>
                        <th><input type="text" id="datefield" placeholder="Date Filter"/></th>
                        <th><input type="text" id="commitfield" placeholder="Commit Filter"/></th>
                        <th><input type="text" id="enginefield" placeholder="Engine Filter"/></th>
                    </tr>
                    <tr>
                        <th style="width: 3%"></th>
                        <th style="">Label</th>
                        <th style="width: 10%">Version</th>
                        <th style="width: 10%">Date</th>
                        <th style="width: 5%">Git Hash</th>
                        <th style="width: 5%">Storage Engine</th>
                    </tr>
                    </thead>

                </table>
                <button action="submit" class="btn btn-primary">Submit</button>
            </form>
        </div>
    </div>
</div>
</body>
</html>
