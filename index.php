<?php
// Get the current directory path
$dir_path = './';

// Open the directory
if ($handle = opendir($dir_path)) {

    // Initialize the HTML output variable
    $html = '<html><head><style>
        body {
            background-color: #1e1e1e;
            color: #ffffff;
            font-family: Arial, sans-serif;
            font-size: 14px;
            line-height: 1.6;
        }
        table {
            margin: 0 auto;
            width: 70%;
            border-collapse: collapse;
        }
        th, td {
            padding: 10px;
            text-align: left;
            vertical-align: top;
            border: 1px solid #333333;
        }
        th {
            background-color: #333333;
            color: #ffffff;
            font-weight: bold;
        }
        a {
            color: #ffffff;
        }
        img{
            width: 32px;
            height: 32px;
        }
    </style></head><body><h1>Userscripts</h1><table>';

    // Add table headers
    $html .= '<tr><th>#</th><th>Icon</th><th>File Name</th><th>Description</th><th>Author</th><th>Last Edit</th></tr>';

    // Initialize the file count
    $count = 1;

    // Loop through all the files in the directory
    while (false !== ($file = readdir($handle))) {

        // Ignore the "." and ".." directories and this PHP file itself
        if ($file != "." && $file != ".." && $file != basename(__FILE__) && strpos($file, '.user.js') !== false) {

            // Read the content of the line starting with "// @description", "// @author"
            // and "// @icon"
            $description = '';
            $author = '';
            $last_edit = '';
            $icon = '';
            $file_handle = fopen($file, 'r');
            if ($file_handle) {
                while (($line = fgets($file_handle)) !== false) {
                    if (strpos($line, '// @description') === 0) {
                        $description = trim(substr($line, strlen('// @description')));
                    } else if (strpos($line, '// @author') === 0) {
                        $author = trim(substr($line, strlen('// @author')));
                    } else if (strpos($line, '// @icon') === 0) {
                        $icon = trim(substr($line, strlen('// @icon')));
                    }
                }
                fclose($file_handle);
                $last_edit = date('Y-m-d H:i:s', filemtime($file));
            }

            // Add the file, author, description, icon and last edit date to the HTML output as a new row in the table
            $html .= '<tr><td>' . $count . '</td><td><img src="' . $icon . '"></td><td><a href="' . $file . '">' . $file . '</a></td><td>' . $description . '</td><td>' . $author . '</td><td>' . $last_edit . '</td></tr>';

            // Increment the file count
            $count++;
        }
    }

    // Close the directory
    closedir($handle);

    // Add the closing HTML tags
    $html .= '</table></body></html>';

    // Output the HTML
    echo $html;
}
?>
