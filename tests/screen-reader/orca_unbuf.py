import builtins, runpy, sys
_open = builtins.open
def open_lb(*a, **k):
    if a and isinstance(a[0], str) and a[0].endswith('orca.log'):
        k['buffering'] = 1
    return _open(*a, **k)
builtins.open = open_lb
sys.argv = ['/usr/bin/orca'] + sys.argv[1:]
runpy.run_path('/usr/bin/orca', run_name='__main__')
