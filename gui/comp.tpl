<!doctype html>
<html lang="us">
  <head>
    <meta charset="utf-8">
    <title>MongoDB Performance Benchmarks</title>
    <link href="static/css/jquery-ui-1.10.1.custom.min.css" rel="stylesheet">
    <link href="static/css/perf_style.css" rel="stylesheet">
    <link href="static/bootstrap-3.1.1-dist/css/bootstrap.min.css" rel="stylesheet">
    <script type="text/javascript" src="static/js/jquery-1.9.1.min.js"></script>
    <script type="text/javascript" src="static/js/jquery-ui-1.10.1.custom.min.js"></script>
    <script type="text/javascript" src="static/js/perf_lib.js"></script>
    <script>
        function filter() {
            var commitregex = $("#commitfield")[0].value;
            var dateregex = $("#datefield")[0].value;
            var labelregex = $("#labelfield")[0].value;
            var reqdata = {commit: commitregex, date: dateregex, label: labelregex, nohtml:true};
            //1) make ajax call to get rows back
            $.get("/test", reqdata).done(function(data) {
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

        window.onload=function() {
            $('#commitfield').bind("keyup", filter);
            $('#datefield').bind("keyup", filter);
            $('#labelfield').bind("keyup", filter);
        }
    </script>
  </head>
  <body>
    <h1>MongoDB Performance Benchmarks</h1>
    <div id="selection">
      <form name="custom_form" id="custom_form" action="results" method="get">
        <button action="submit">Submit</button>
        <table class="table table-striped">
          <tr>
            <td></td>
            <td><input type="text" id="commitfield" name="commit" />
            <td><input type="text" id="datefield" name="date" />
            <td><input type="text" id="labelfield" name="label" />
          </tr>
          <tr>
            <th>Select</th>
            <th>Git Hash</th>
            <th>Date</th>
            <th>Label</th>
          </tr>
          %for row in allrows:
          <tr id="{{row['_id']}}" name="docrow">
            <td><input type="checkbox" name="id" value={{row["_id"]}}></td>
            <td>{{row["commit"]}}</td>
            <td>{{row["date"]}}</td>
            <td>{{row["label"]}}</td>
          </tr>
          %end
        </table>
        <button action="submit">Submit</button>
      </form>
    </div>
  </body>
</html>
