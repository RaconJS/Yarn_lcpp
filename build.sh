#rustc main.rs -C prefer-dynamic -C opt-level=z --extern=regex=libregex.rlib --extern=regex_syntax=libregex_syntax.rlib  ;
#strip -s main;
#wc -c main;
reset;
echo start;
cargo ./main.rs;
./target/build/built_compiler;
