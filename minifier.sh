#!/bin/bash

minifier() {
  echo "#!${shell:-/bin/bash}"
  sed -r ':a;N;$!ba;s/(^(\s*(#.*\n)?|\n+))//gm' "$@" |
    sed -r "s/(=|echo )(''|\"\")/\1/gm" |
    sed -r 's/"([A-Za-z0-9_.-]+)"/\1/gm' |
    sed -r 's/\)\s+\{/\)\{/gm' |
    sed -r 's/\s*(;|\((\)|\(|!|\?)|[<>][<=>])\s*/\1/gm' |
    sed -r 's/\s+(\))/\1/gm' |
    sed -r 's/==/=/gm' |
    sed -r 's/([^<])\s+</\1</gm' |
    sed -r ':a;N;$!ba;s/([^\\])\\\n/\1 /gm' |
    sed -r ':a;N;$!ba;s/^([^\(]+)\)\s*\n*(.+)$/\1)\2/gm' |
    sed -r ':a;N;$!ba;s/\s*\n*((;|\||&){1,2})\s*\n*/\1/gm' |
    sed -r 's/\s+$//gm' |
    sed -r 's/"\$\?"/\$\?/gm' |
    sed -r "s/\((\"\"|'')\)/\(\)/gm" |
    sed -r 's/ {2,}/ /gm'
  return $?
}

if [ ! "$*" ]; then
  echo "Error: no input specified!"
  exit 1
fi

while [ "$*" ]; do

  case "$1" in
  -o | --output) out=$2 && shift ;;
  -o=* | --output=*) out=${1#*=} ;;
  --shell | -sh)
    if [[ $2 = "/"* ]]; then
      shell=$2
    else
      shell="/usr/bin/env $2"
    fi
    shift
    ;;
  --shell=* | -sh=*) shell=${1#*=} ;;
  -h | --help)
    cat <<EOF
BASH minifier by Shadichy

Usage: $0 (-o output) (-sh shell) (-h) file1 file2 ...

  -o, --output    specify output file
  -sh, --shell    specify output #\!/bin/shellname
  -h, --help      print this help

EOF
    exit 0
    ;;
  *) break ;;
  esac
  shift
done

if [ "$out" ]; then
  [[ $out = *"/"* ]] && mkdir -p "${out%/*}"
  minifier "$@" >"$out"
else
  minifier "$@"
fi

exit $?
