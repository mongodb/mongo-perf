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
                    "bFilter": false,
                    "bInfo": false,
                    "bSortable": true,
                    "bAutoWidth": true,
                });
        });

        function isVisible(elem) {
            return elem.offsetWidth > 0 || elem.offsetHeight > 0;
        }

        function filter() {
            var commitregex = $("#commitfield")[0].value;
            var startdate = $("#startfield")[0].value;
            var enddate = $("#endfield")[0].value;
            var labelregex = $("#labelfield")[0].value;
            var versionregex = $("#versionfield")[0].value;
            var reqdata = {commit: commitregex, start: startdate, end: enddate, label: labelregex, version: versionregex, nohtml:true};

            //1) make ajax call to get rows back
            $.get("/", reqdata).done(function(data) {
                    //2) iterate over all rows
                    valrows = $('[name="docrow"]')
                    for(var i = 0; i < valrows.length; i++) {
                        //see if row is in our ids
                        var foundrow = false;
                        //TODO should maintain data structure to do this
                        for(var j = 0; j < data.length; j++) {
                            if(data[j]['_id'] == valrows[i].id) {
                                foundrow = true;
                                break;
                            }
                        }
                        if(foundrow) { //if found, ensure its not hidden
                            valrows[i].style.display = '';
                        } else { //else, ensure its hidden
                            valrows[i].style.display = 'none';
                        }
                    }
                }
            );
            return false;
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

        window.onload=function() {
            $('#commitfield').bind("keyup", filter);
            $('#datefield').bind("keyup", filter);
            $('#labelfield').bind("keyup", filter);
            $('#versionfield').bind("keyup", filter);
            $('#startfield').datepicker({
              onSelect: function(dateText, isnt) {
                filter();
             }
            });
            $('#endfield').datepicker({
              onSelect: function(dateText, isnt) {
                filter();
             }
            });
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
                <td><button onclick="selectClicked();" class="btn btn-default" type="button" id="selectall">Select All</button></td>
                <td><input type="text" id="labelfield" placeholder="Label Filter" /></td>
                <td><input type="text" id="versionfield" placeholder="Version Filter" /></td>
                <td><input type="text" id="startfield" placeholder="Start Date Filter" />
                    <input type="text" id="endfield" placeholder="End Date Filter" /></td>
                <td><input type="text" id="commitfield" name="commit" placeholder="Commit Filter" /></td>
              </tr>
              <tr>
                <th style="width: 10%">Select</th>
                <th style="width: 25%">Label</th>
                <th style="width: 10%">Version</th>
                <th style="width: 20%">Date</th>
                <th style="width: 35%">Git Hash</th>
              </tr>
          </thead>
          %for row in allrows:
          <tr id="{{row['_id']}}" name="docrow">
            <td><input type="checkbox" name="id" value={{row["_id"]}}></td>
            <td>{{row["label"]}}</td>
            <td>{{row["version"]}}</td>
            <td>{{row["date"]}}</td>
            <td><a href="https://github.com/mongodb/mongo/commit/{{row['commit']}}">{{row['commit']}}</a></td>
          </tr>
          %end
        </table>
        <button action="submit" class="btn btn-primary">Submit</button>
      </form>
    </div>
  </body>
  </div>
</html>
