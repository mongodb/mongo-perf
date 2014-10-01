<!doctype html>
<html lang="us">
  <head>
    <meta charset="utf-8">
    <title>MongoDB Performance Benchmarks</title>
    <link href="static/css/jquery-ui-1.10.1.custom.min.css" rel="stylesheet">
    <link href="static/css/perf_style.css" rel="stylesheet">
    <link href="static/css/page.css" rel="stylesheet">
    <link href="static/bootstrap-3.1.1-dist/css/bootstrap.min.css" rel="stylesheet">
    <script type="text/javascript" src="static/js/jquery-1.9.1.min.js"></script>
    <script type="text/javascript" src="static/js/jquery-ui-1.10.1.custom.min.js"></script>
    <script type="text/javascript" src="static/js/jquery.dataTables.min.js"></script>
    <script type="text/javascript" src="static/js/perf_lib.js"></script>
    <script>
        $(document).ready(function(){
            $('#selectTable').dataTable({
                    "bPaginate": false,
                    "bLengthChange": false,
                    "bInfo": false,
                    "bSortable": true,
                    "bAutoWidth": true,
                    "dom": "lrtip"
            });

            var table = $('#selectTable').DataTable();

            //manually set filtering up
            $('#labelfield').on('keyup change', function() {
                table.column(1).search(this.value).draw();
            });
            $('#versionfield').on('keyup change', function() {
                table.column(2).search(this.value).draw();
            });
            //TODO get date range working
            $('#datefield').on('keyup change', function() {
                table.column(3).search(this.value).draw();
            });
            $('#commitfield').on('keyup change', function() {
                table.column(4).search(this.value).draw();
            });
            $('#enginefield').on('keyup change', function() {
                table.column(5).search(this.value).draw();
            });

        });

        function isVisible(elem) {
            return elem.offsetWidth > 0 || elem.offsetHeight > 0;
        }

        var selectBool = false;
        function selectClicked() {
            var selectRows = $('[name="id"]')
            for(var i = 0; i < selectRows.length; i++) {
                if(!selectBool) {
                    //set to selected if its not hidden
                    if(isVisible(selectRows[i])) {
                        selectRows[i].checked=true;
                    }
                } else {
                    //set to unselected
                    selectRows[i].checked=false;
                }
            }

            if(!selectBool) {
                $('#selectall')[0].innerHTML = "Unselect All";
            } else {
                $('#selectall')[0].innerHTML = "Select All";
            }

            selectBool = !selectBool;
            return false;
        }
    </script>
  </head>
  <div class="container">
  <body>
    <h1>MongoDB Performance Benchmarks</h1>
    <div id="selection" class="row">
      <form name="custom_form" id="custom_form" action="results" method="get">
        <button action="submit" class="btn btn-primary">Submit</button>
        <table id="selectTable" class="table table-striped">
          <thead>
              <tr>
                <th><button onclick="selectClicked();" class="btn btn-default" type="button" id="selectall">Select All</button></td>
                <th><input type="text" id="labelfield" placeholder="Label Filter" /></th>
                <th><input type="text" id="versionfield" placeholder="Version Filter" /></th>
                <th><input type="text" id="datefield" placeholder="Date Filter" /></th>
                <th><input type="text" id="commitfield" name="commit" placeholder="Commit Filter" /></th>
                <th><input type="text" id="enginefield" name="engine" placeholder="Engine Filter" /></th>
              </tr>
              <tr>
                <th style="width: 10%">Select</th>
                <th style="width: 25%">Label</th>
                <th style="width: 10%">Version</th>
                <th style="width: 20%">Date</th>
                  <th style="width: 35%">Git Hash</th>
                  <th style="width: 35%">Storage Engine</th>
              </tr>
          </thead>
          %for row in allrows:
          <tr id="{{row['_id']}}" name="docrow">
            <td><input type="checkbox" name="id" value={{row["_id"]}}></td>
            <td>{{row["label"]}}</td>
            <td>{{row["version"]}}</td>
            <td>{{row["date"]}}</td>
            <td><a href="https://github.com/mongodb/mongo/commit/{{row['commit']}}">{{row['commit']}}</a></td>
            <td>{{row["server_storage_engine"]}}</td>
          </tr>
          %end
        </table>
        <button action="submit" class="btn btn-primary">Submit</button>
      </form>
    </div>
  </body>
  </div>
</html>
